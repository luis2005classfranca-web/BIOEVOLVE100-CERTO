import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Initialize Gemini AI
  const apiKey = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;
  
  const ai = new GoogleGenAI({ 
    apiKey: apiKey || "MISSING_KEY",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const isGeminiQuotaError = (error: any) => {
    return error?.status === 429 || 
           error?.code === 429 || 
           (error?.message && (
             error.message.includes("Quota exceeded") || 
             error.message.includes("RESOURCE_EXHAUSTED") ||
             error.message.includes("429")
           ));
  };

  // AI Extraction Proxy Route
  app.post("/api/gemini/extract", async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      
      if (!image) {
        return res.status(400).json({ error: "Imagem não fornecida." });
      }

      const prompt = `Analise a imagem e extraia dados de saúde. 
      Categorize em um destes grupos: Composição Corporal, Metabolismo e Glicemia, Perfil Lipídico, Marcadores Inflamatórios, Hormônios, Hemograma, Outros.
      Identifique a data do exame e os valores exatos.
      JSON: [{ analyte, value, unit, referenceRange, category, date }]`;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: {
          parts: [
            { text: prompt },
            { 
              inlineData: { 
                data: image.split(",")[1] || image, 
                mimeType: mimeType || "image/jpeg" 
              } 
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                analyte: { type: Type.STRING, description: "Name of the test or marker" },
                value: { type: Type.STRING, description: "Numeric value as string" },
                unit: { type: Type.STRING, description: "Measurement unit" },
                referenceRange: { type: Type.STRING, description: "Reference range text" },
                category: { type: Type.STRING, description: "Health category" },
                date: { type: Type.STRING, description: "Exam date if found" }
              }
            }
          }
        }
      });
      
      const text = response.text || "[]";
      
      try {
        res.json(JSON.parse(text));
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError, "Raw Text:", text);
        res.status(500).json({ error: "Erro ao processar dados extraídos." });
      }
    } catch (error: any) {
      console.error("Extraction Proxy Error Details:", error);
      if (isGeminiQuotaError(error)) {
        return res.status(429).json({ error: "Limite da IA atingido. Tente em instantes.", isQuotaError: true });
      }
      res.status(500).json({ error: "Falha na análise do documento. Detalhes: " + (error?.message || "Erro desconhecido") });
    }
  });

  // AI Explanation Proxy Route
  app.post("/api/gemini/explain", async (req, res) => {
    try {
      const { exams } = req.body;

      const prompt = `Explique estes resultados para o paciente (detalhado, claro, acolhedor).
      Use termos simples. Se houver valores fora da faixa, explique possibilidades e sugira médico.
      DADOS: ${JSON.stringify(exams)}
      JSON: { "explanation": "Markdown text" }`;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: { type: Type.STRING }
            },
            required: ["explanation"]
          }
        }
      });

      const text = response.text || "{}";
      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("AI Explanation Error Details:", error);
      if (isGeminiQuotaError(error)) {
        return res.status(429).json({ error: "Limite da IA atingido.", isQuotaError: true });
      }
      res.status(500).json({ error: "Falha ao explicar resultados." });
    }
  });

  // AI Insight Proxy Route
  app.post("/api/gemini/insight", async (req, res) => {
    try {
      const { exams, wearables } = req.body;

      const prompt = `Analise este histórico de saúde do usuário para identificar tendências de longo prazo e gerar insights comparativos.
      DADOS DE EXAMES (Histórico): ${JSON.stringify(exams)}
      ATIVIDADE (Última semana): ${JSON.stringify(wearables)}
      
      Instruções:
      1. Se houver mais de um exame do mesmo tipo em datas diferentes, compare-os.
      2. Gere um BioScore (0-100) que reflita o estado atual comparado ao histórico.
      3. Seja específico e técnico, mas motivador.
      
      Responda estritamente em formato JSON: 
      { 
        "text": "Análise detalhada aqui", 
        "actionableTip": "Dica prática", 
        "bioScore": 85 
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              actionableTip: { type: Type.STRING },
              bioScore: { type: Type.NUMBER }
            },
            required: ["text", "actionableTip", "bioScore"]
          }
        }
      });

      const text = response.text || "{}";
      res.json(JSON.parse(text));
    } catch (error: any) {
      if (isGeminiQuotaError(error)) {
        console.warn("[Gemini API] Quota exceeded on insight request.");
        return res.status(429).json({ 
          error: "Limite de uso da IA atingido para geração de insights. Tente novamente em 20 segundos.",
          isQuotaError: true
        });
      }

      console.error("AI Insight Proxy Error:", error);
      res.status(500).json({ error: "Falha ao gerar insight via servidor." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BioEvolve backend running on http://localhost:${PORT}`);
  });
}

startServer();

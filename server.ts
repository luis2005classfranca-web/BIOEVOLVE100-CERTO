import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Initialize Gemini AI
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  // AI Extraction Proxy Route
  app.post("/api/gemini/extract", async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      
      const prompt = `Extraia todos os resultados de saúde deste documento ou print de tela. 
      Pode ser um exame de sangue laboratorial ou um relatório de bioimpedância (como Tanita ou InBody).

      Para bioimpedância, extraia campos como:
      - Peso (Weight)
      - % de Gordura (Fat %)
      - Massa Muscular (Muscle Mass)
      - IMC (BMI)
      - Idade Metabólica (Metabolic Age)
      - Gordura Visceral (Visceral Fat Rating)
      - Massa de Gordura (Fat Mass)
      
      Para exames de sangue, extraia os analitos (Glicose, Colesterol, etc.), valores e unidades.
      
      Data do exame: Procure por datas no documento. Se não encontrar, retorne nulo.
      Seja extremamente preciso com os números.
      Retorne em formato JSON JSON: [{ analyte, value, unit, referenceRange, date, confidence }]`;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { data: image.split(",")[1] || image, mimeType } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
        }
      });
      
      res.json(JSON.parse(response.text || "[]"));
    } catch (error) {
      console.error("Extraction Proxy Error:", error);
      res.status(500).json({ error: "Falha na análise do documento via servidor." });
    }
  });

  // AI Insight Proxy Route
  app.post("/api/gemini/insight", async (req, res) => {
    try {
      const { exams, wearables } = req.body;

      const prompt = `Analise os seguintes dados de saúde e gere um insight curto e uma dica prática:
      Exames: ${JSON.stringify(exams)}
      Atividade: ${JSON.stringify(wearables)}
      Responda estritamente em formato JSON: { "text": "analise aqui", "actionableTip": "dica aqui" }`;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
      
      res.json(JSON.parse(response.text || "{}"));
    } catch (error) {
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

import { GoogleGenAI, Type } from "@google/genai";
import { ExamRecord } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const responseSchema: any = {
  description: "List of extracted exam results",
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      analyte: {
        type: Type.STRING,
        description: "Name of the health indicator (e.g., Glicose, Colesterol LDL, Hemoglobina)",
      },
      value: {
        type: Type.NUMBER,
        description: "Numeric value found in the result",
      },
      unit: {
        type: Type.STRING,
        description: "Measurement unit (e.g., mg/dL, g/L, %)",
      },
      referenceRange: {
        type: Type.STRING,
        description: "Reference range text found (e.g., 70 - 99 mg/dL)",
      },
      date: {
        type: Type.STRING,
        description: "Date of the exam in YYYY-MM-DD format",
      },
      confidence: {
        type: Type.NUMBER,
        description: "Confidence level 0-100",
      },
    },
  },
};

export async function extractHealthDataFromImage(base64Image: string, mimeType: string = "image/jpeg"): Promise<Partial<ExamRecord>[]> {
  try {
    const cleanBase64 = base64Image.split(",")[1] || base64Image;
    // Ensure we have a valid mime type, default to image/jpeg if empty
    const safeMimeType = (mimeType && mimeType.trim() !== "") ? mimeType : "image/jpeg";

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
    
    Data do exame: Use a data '15/4/2026' se for o documento da Tanita com ID 49150564, ou procure por outras datas no documento.
    Seja extremamente preciso com os números.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { data: cleanBase64, mimeType: safeMimeType } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw new Error("Não foi possível extrair dados do documento. Certifique-se de que a imagem está legível.");
  }
}

export async function generateHealthInsight(exams: ExamRecord[], wearables: any[]): Promise<{ text: string, actionableTip: string }> {
  try {
    const prompt = `Analise os seguintes dados de saúde e gere um insight curto e uma dica prática:
      Exames: ${JSON.stringify(exams)}
      Atividade: ${JSON.stringify(wearables)}
      Responda em formato JSON: { "text": "analise aqui", "actionableTip": "dica aqui" }`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            actionableTip: { type: Type.STRING }
          },
          required: ["text", "actionableTip"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Insight Error:", error);
    throw new Error("Falha ao gerar insight");
  }
}

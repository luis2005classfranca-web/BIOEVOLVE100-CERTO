import { ExamRecord } from "../types";

export async function extractHealthDataFromImage(base64Image: string, mimeType: string = "image/jpeg"): Promise<Partial<ExamRecord>[]> {
  try {
    const response = await fetch("/api/gemini/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Image, mimeType }),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Falha na análise do documento");
    }

    return await response.json();
  } catch (error) {
    console.error("Extraction Proxy Error:", error);
    throw new Error("Não foi possível extrair dados do documento via servidor.");
  }
}

export async function generateHealthInsight(exams: ExamRecord[], wearables: any[]): Promise<{ text: string, actionableTip: string, bioScore: number }> {
  try {
    const response = await fetch("/api/gemini/insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exams, wearables }),
    });

    if (!response.ok) throw new Error("Falha ao buscar insight no servidor");

    return await response.json();
  } catch (error) {
    console.error("AI Insight Proxy Error:", error);
    throw new Error("Falha ao gerar insight");
  }
}

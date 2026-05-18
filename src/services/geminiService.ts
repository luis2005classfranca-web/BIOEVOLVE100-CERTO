import { ExamRecord } from "../types";

export async function extractHealthDataFromImage(base64Image: string, mimeType: string = "image/jpeg"): Promise<Partial<ExamRecord>[]> {
  try {
    const response = await fetch("/api/gemini/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Image, mimeType }),
    });

    if (!response.ok) {
      let errorMessage = "Falha na análise do documento";
      try {
        const errData = await response.json();
        errorMessage = errData.error || errorMessage;
      } catch (e) {
        // Fallback if not JSON
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error("Extraction Proxy Error:", error);
    if (error instanceof Error) throw error;
    throw new Error("Não foi possível extrair dados do documento via servidor.");
  }
}

export async function explainHealthResults(exams: Partial<ExamRecord>[]): Promise<string> {
  try {
    const response = await fetch("/api/gemini/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exams }),
    });

    if (!response.ok) {
      let errorMessage = "Falha ao explicar resultados";
      try {
        const errData = await response.json();
        errorMessage = errData.error || errorMessage;
      } catch (e) { /* Fallback */ }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.explanation;
  } catch (error) {
    console.error("AI Explanation Error:", error);
    if (error instanceof Error) throw error;
    throw new Error("Falha ao gerar explicação dos resultados.");
  }
}

export async function generateHealthInsight(exams: ExamRecord[], wearables: any[]): Promise<{ text: string, actionableTip: string, bioScore: number }> {
  try {
    const response = await fetch("/api/gemini/insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exams, wearables }),
    });

    if (!response.ok) {
      let errorMessage = "Falha ao buscar insight no servidor";
      try {
        const errData = await response.json();
        errorMessage = errData.error || errorMessage;
      } catch (e) { /* Fallback */ }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error("AI Insight Proxy Error:", error);
    if (error instanceof Error) throw error;
    throw new Error("Falha ao gerar insight");
  }
}

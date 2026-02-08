
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini API with Vite environment variable
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  try {
    ai = new GoogleGenAI({ apiKey });
    console.info("✅ Gemini AI initialized successfully");
  } catch (e) {
    console.error("❌ Failed to initialize Gemini AI", e);
  }
} else {
  console.warn("⚠️ Gemini API Key missing. AI features will be disabled. Add VITE_GEMINI_API_KEY to your .env.local file.");
}

export const AIService = {
  /**
   * Generates a checklist of subtasks based on the main task title and description.
   * Uses Gemini 3 Flash for speed and JSON structure.
   */
  async generateSubtasks(title: string, description: string): Promise<string[]> {
    if (!ai) return ["Review task requirements", "Update subtasks manually"];

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash', // Fallback to stable model if preview unavailable
        contents: `You are an expert audit manager. Create a concise checklist of 3 to 6 actionable subtasks for a task titled "${title}". 
        Context: "${description}".
        Return ONLY a raw JSON array of strings (e.g. ["Review documents", "Prepare draft"]).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const text = response.text;
      if (!text) return [];
      return JSON.parse(text);
    } catch (error) {
      console.error("Gemini Generation Error:", error);
      return [
        "Review initial requirements",
        "Gather necessary documentation",
        "Perform compliance check",
        "Draft preliminary report"
      ];
    }
  },

  /**
   * Verifies an address or finds a location using Google Maps Grounding.
   * Uses Gemini 2.5 Flash with googleMaps tool.
   */
  async findLocationDetails(query: string): Promise<{ text: string, mapLink?: string }> {
    // DISABLED: Google Maps integration removed per user request
    return {
      text: "🗺️ Location services are currently disabled. You can manually enter addresses."
    };
  },

  /**
   * Researches a concept related to a specific resource using Google Search Grounding.
   */
  async researchConcept(resourceTitle: string, userQuery: string): Promise<string> {
    if (!ai) {
      return "🔑 **AI Research Assistant requires setup:**\n\n" +
        "Please ask your administrator to add the VITE_GEMINI_API_KEY to the environment variables.\n" +
        "Get a free API key from: https://makersuite.google.com/app/apikey";
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: `I am reading a document titled "${resourceTitle}". 
        Help me understand this concept: "${userQuery}".
        Provide a clear, professional explanation suitable for an auditor or accountant. 
        Use Google Search to find the most up-to-date regulations or standards if applicable.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      // Return text directly. Grounding sources are automatically handled by the SDK but we just return the synthesis here.
      return response.text || "I couldn't find specific information on that topic. Try rephrasing your question.";
    } catch (error) {
      console.error("Research Error:", error);
      return "❌ Research service error: " + (error instanceof Error ? error.message : "Connection failed. Please try again.");
    }
  },

  /**
   * Suggests the best staff member for a task based on workload and role.
   */
  async suggestStaffAssignment(
    taskTitle: string,
    taskPriority: string,
    staffProfiles: any[],
    activeTasks: any[]
  ): Promise<{ uid: string, reasoning: string } | null> {
    if (!ai) return null;

    try {
      // 1. Calculate workload per staff
      const workloadMap = staffProfiles.map(staff => {
        const load = activeTasks.filter(t => t.assignedTo.includes(staff.uid) && t.status !== 'COMPLETED').length;
        return {
          uid: staff.uid,
          name: staff.displayName,
          role: staff.role,
          department: staff.department,
          currentLoad: load
        };
      });

      const prompt = `
        You are an intelligent resource manager for an audit firm.
        Task: "${taskTitle}"
        Priority: "${taskPriority}"
        
        Staff Availability Data:
        ${JSON.stringify(workloadMap)}
        
        Rules:
        1. "URGENT" or "HIGH" priority tasks should ideally go to "MANAGER" or "ADMIN" roles if their load is < 5, otherwise an experienced "STAFF".
        2. Distribute work evenly. Prefer staff with lower 'currentLoad'.
        3. Match department if possible (e.g. Audit task -> Audit dept).
        
        Recommend the single best User UID.
        Return JSON: { "uid": "string", "reasoning": "string" }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              uid: { type: Type.STRING },
              reasoning: { type: Type.STRING }
            }
          }
        }
      });

      const text = response.text;
      if (!text) return null;
      return JSON.parse(text);

    } catch (error) {
      console.error("Auto-Assign Error:", error);
      return null;
    }
  }
};

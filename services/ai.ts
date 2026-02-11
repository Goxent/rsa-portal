import Anthropic from "@anthropic-ai/sdk";

// Initialize Claude API with Vite environment variable
const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;
let anthropic: Anthropic | null = null;

if (apiKey) {
  try {
    anthropic = new Anthropic({ apiKey });
    console.info("✅ Claude AI initialized successfully");
  } catch (e) {
    console.error("❌ Failed to initialize Claude AI", e);
  }
} else {
  console.warn("⚠️ Claude API Key missing. AI features will be disabled. Add VITE_CLAUDE_API_KEY to your .env.local file.");
}

export const AIService = {
  /**
   * Generates a checklist of subtasks based on the main task title and description.
   * Uses Claude 3.5 Sonnet for intelligent task breakdown.
   */
  async generateSubtasks(title: string, description: string): Promise<string[]> {
    if (!anthropic) return ["Review task requirements", "Update subtasks manually"];

    try {
      const message = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `You are an expert audit manager. Create a concise checklist of 3 to 6 actionable subtasks for a task titled "${title}". 
          Context: "${description}".
          Return ONLY a raw JSON array of strings (e.g. ["Review documents", "Prepare draft"]). No markdown, no explanation, just the JSON array.`
        }]
      });

      const text = message.content[0].type === 'text' ? message.content[0].text : '';
      if (!text) return [];

      // Remove markdown code blocks if present
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanText);
    } catch (error) {
      console.error("Claude Generation Error:", error);
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
   * Uses Claude with location reasoning (no map integration).
   */
  async findLocationDetails(query: string): Promise<{ text: string, mapLink?: string }> {
    // DISABLED: Google Maps integration removed per user request
    return {
      text: "🗺️ Location services are currently disabled. You can manually enter addresses."
    };
  },

  /**
   * Researches a concept related to a specific resource.
   * Uses Claude's knowledge base and provided document content.
   */
  async researchConcept(resourceTitle: string, userQuery: string, documentContent?: string): Promise<string> {
    if (!anthropic) {
      return "🔑 **AI Research Assistant requires setup:**\n\n" +
        "Please ask your administrator to add the VITE_CLAUDE_API_KEY to the environment variables.\n" +
        "Get an API key from: https://console.anthropic.com/";
    }

    try {
      const contentContext = documentContent
        ? `Document Content:\n${documentContent.substring(0, 20000)}... (truncated)`
        : "No specific document content provided.";

      const message = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: `I am reading a document titled "${resourceTitle}". 
          
          ${contentContext}

          User Query: "${userQuery}"
          
          Provide a clear, professional explanation based on the document content above and your general knowledge.
          If the answer is in the document, cite it. If not, provide general professional advice.
          
          Format your response in markdown with:
          - Clear headings
          - Bullet points for key concepts
          - Examples where helpful`
        }]
      });

      const text = message.content[0].type === 'text' ? message.content[0].text : '';
      return text || "I couldn't find specific information on that topic. Try rephrasing your question.";
    } catch (error) {
      console.error("Research Error:", error);
      return "❌ Research service error: " + (error instanceof Error ? error.message : "Connection failed. Please try again.");
    }
  },

  /**
   * Suggests the best staff member for a task based on workload and role.
   * Uses Claude's reasoning capabilities for intelligent assignment.
   */
  async suggestStaffAssignment(
    taskTitle: string,
    taskPriority: string,
    staffProfiles: any[],
    activeTasks: any[]
  ): Promise<{ uid: string, reasoning: string } | null> {
    if (!anthropic) return null;

    try {
      // Calculate workload per staff
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

      const message = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `You are an intelligent resource manager for an audit firm.
          Task: "${taskTitle}"
          Priority: "${taskPriority}"
          
          Staff Availability Data:
          ${JSON.stringify(workloadMap, null, 2)}
          
          Rules:
          1. "URGENT" or "HIGH" priority tasks should ideally go to "MANAGER" or "ADMIN" roles if their load is < 5, otherwise an experienced "STAFF".
          2. Distribute work evenly. Prefer staff with lower 'currentLoad'.
          3. Match department if possible (e.g. Audit task -> Audit dept).
          
          Recommend the single best User UID.
          Return ONLY a raw JSON object: { "uid": "string", "reasoning": "string" }
          No markdown, no explanation, just the JSON object.`
        }]
      });

      const text = message.content[0].type === 'text' ? message.content[0].text : '';
      if (!text) return null;

      // Remove markdown code blocks if present
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanText);

    } catch (error) {
      console.error("Auto-Assign Error:", error);
      return null;
    }
  }
};

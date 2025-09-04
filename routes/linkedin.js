import express from 'express';
import OpenAI from 'openai';

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Generate LinkedIn profile content
router.post('/generate-profile', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      title,
      industry,
      location,
      currentCompany,
      experienceYears,
      careerGoals,
      skills
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !title || !industry || !location || !currentCompany || !experienceYears) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const fullName = `${firstName} ${lastName}`;
    const skillsList = skills && skills.length > 0 ? skills.join(', ') : 'various professional skills';
    const experienceLevel = getExperienceLevel(experienceYears);

    // Generate professional headline
    const headlinePrompt = `Create a professional LinkedIn headline for ${fullName}, a ${title} at ${currentCompany} in the ${industry} industry. 
    Location: ${location}
    Experience: ${experienceLevel}
    Key skills: ${skillsList}
    
    The headline should be 120 characters or less, engaging, and include relevant keywords. Focus on value proposition and what makes them unique. Do not include emojis.`;

    // Generate about section
    const aboutPrompt = `Create a compelling LinkedIn "About" section for ${fullName}, a ${title} at ${currentCompany} in the ${industry} industry.
    
    Profile details:
    - Experience: ${experienceLevel}
    - Location: ${location}
    - Key skills: ${skillsList}
    - Career goals: ${careerGoals || 'Professional growth and development'}
    
    The about section should be:
    - 150-300 words
    - Written in first person
    - Professional yet personable
    - Include specific achievements or value propositions
    - End with a call-to-action for networking
    - Use paragraph breaks for readability
    - No emojis or excessive formatting`;

    // Generate experience description template
    const experiencePrompt = `Create a professional experience description template for a ${title} position at ${currentCompany} in the ${industry} industry.
    
    Details:
    - Experience level: ${experienceLevel}
    - Key skills: ${skillsList}
    - Industry: ${industry}
    
    The description should:
    - Be 100-200 words
    - Use bullet points or short paragraphs
    - Include specific responsibilities and achievements
    - Use action verbs and quantifiable results where possible
    - Be adaptable to similar roles
    - Focus on impact and value delivered`;

    // Make parallel API calls for efficiency
    const [headlineResponse, aboutResponse, experienceResponse] = await Promise.all([
      openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: headlinePrompt }],
        max_tokens: 150,
        temperature: 0.7
      }),
      openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: aboutPrompt }],
        max_tokens: 400,
        temperature: 0.7
      }),
      openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: experiencePrompt }],
        max_tokens: 300,
        temperature: 0.7
      })
    ]);

    const generatedContent = {
      headline: headlineResponse.choices[0].message.content.trim(),
      about: aboutResponse.choices[0].message.content.trim(),
      experience: experienceResponse.choices[0].message.content.trim()
    };

    res.json({
      success: true,
      content: generatedContent,
      profile: {
        fullName,
        title,
        company: currentCompany,
        industry,
        location,
        experienceLevel,
        skills: skillsList
      }
    });

  } catch (error) {
    console.error('LinkedIn profile generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate LinkedIn profile content. Please try again.'
    });
  }
});

function getExperienceLevel(experienceYears) {
  switch (experienceYears) {
    case '0-1':
      return 'Entry Level (0-1 years)';
    case '2-5':
      return 'Mid Level (2-5 years)';
    case '6-10':
      return 'Senior Level (6-10 years)';
    case '11-15':
      return 'Expert Level (11-15 years)';
    case '15+':
      return 'Executive Level (15+ years)';
    default:
      return 'Professional';
  }
}

export default router;

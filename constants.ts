import { Dialogue } from './types';

export const DIALOGUES: Dialogue[] = [
  {
    id: 'd1',
    title: 'Global Climate Summit',
    scenario: 'A news anchor summarizing the key outcomes of the latest climate conference.',
    difficulty: 'Advanced',
    category: 'BBC News',
    duration: '3 min',
    imageUrl: 'https://images.unsplash.com/photo-1621274403997-37aace184f49?q=80&w=800&auto=format&fit=crop',
    lines: [
      { speaker: 'Anchor', text: "Good evening. World leaders have concluded the summit in Geneva today with a landmark agreement." },
      { speaker: 'Reporter', text: "That's right. The accord promises to reduce carbon emissions by a further 40% over the next decade." },
      { speaker: 'Anchor', text: "However, critics argue that the timeline for phasing out coal remains too vague." },
      { speaker: 'Reporter', text: "Indeed. While the ambition is clear, the enforcement mechanisms are yet to be fully defined." }
    ]
  },
  {
    id: 'd2',
    title: 'The Power of Micro-Habits',
    scenario: 'A speaker explaining how small changes lead to big results.',
    difficulty: 'Intermediate',
    category: 'TED Talk',
    duration: '5 min',
    imageUrl: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?q=80&w=800&auto=format&fit=crop',
    lines: [
      { speaker: 'Speaker', text: "We often think that to change our lives, we need to make massive changes." },
      { speaker: 'Speaker', text: "But actually, it is the tiny habits, the ones that take less than two minutes, that compound over time." },
      { speaker: 'Speaker', text: "Imagine improving by just one percent every single day." },
      { speaker: 'Speaker', text: "By the end of the year, you wouldn't be twice as good; you would be thirty-seven times better." }
    ]
  },
  {
    id: 'd3',
    title: 'Morning Coffee Routine',
    scenario: 'A vlogger describing their peaceful morning preparation.',
    difficulty: 'Beginner',
    category: 'Life Vlog',
    duration: '2 min',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800&auto=format&fit=crop',
    lines: [
      { speaker: 'Vlogger', text: "Hey guys, welcome back to my channel. Today I want to show you my slow morning routine." },
      { speaker: 'Vlogger', text: "First, I always start with a glass of warm lemon water. It really wakes me up." },
      { speaker: 'Vlogger', text: "Then, I grind my coffee beans fresh. The smell is just incredible." },
      { speaker: 'Vlogger', text: "I like to sit by the window and read for ten minutes before looking at my phone." }
    ]
  },
  {
    id: 'd4',
    title: 'Tech CEO Interview',
    scenario: 'A journalist asking a CEO about the future of AI.',
    difficulty: 'Advanced',
    category: 'Interview',
    duration: '4 min',
    imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=800&auto=format&fit=crop',
    lines: [
      { speaker: 'Interviewer', text: "With the rapid rise of generative AI, many people are worried about job security." },
      { speaker: 'CEO', text: "It's a valid concern, but I view it as a transformation rather than a replacement." },
      { speaker: 'Interviewer', text: "So, you believe humans will work alongside these tools?" },
      { speaker: 'CEO', text: "Precisely. The roles will evolve to focus more on creativity and strategic oversight." }
    ]
  },
  {
    id: 'd5',
    title: 'Ordering a Train Ticket',
    scenario: 'Buying a ticket at a railway station in London.',
    difficulty: 'Intermediate',
    category: 'Daily',
    duration: '2 min',
    imageUrl: 'https://images.unsplash.com/photo-1474487548417-781cb714c2f0?q=80&w=800&auto=format&fit=crop',
    lines: [
      { speaker: 'Passenger', text: "Good morning. I'd like a return ticket to Edinburgh, please." },
      { speaker: 'Agent', text: "Certainly. When would you like to travel?" },
      { speaker: 'Passenger', text: "The next train available. Is it direct?" },
      { speaker: 'Agent', text: "Yes, departing at 10:30 from Platform 4. That’s £85." }
    ]
  }
];

export const CATEGORY_IMAGES: Record<string, string[]> = {
  'BBC News': [
    'https://images.unsplash.com/photo-1495020689067-958852a7765e?q=80&w=800&auto=format&fit=crop', 
    'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=800&auto=format&fit=crop', 
    'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?q=80&w=800&auto=format&fit=crop'  
  ],
  'TED Talk': [
    'https://images.unsplash.com/photo-1475721027760-4478f4c78c7c?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1544531586-fde5298cdd40?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1560523160-754a9e25c68f?q=80&w=800&auto=format&fit=crop'  
  ],
  'Interview': [
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=800&auto=format&fit=crop', 
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop', 
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=800&auto=format&fit=crop'  
  ],
  'Life Vlog': [
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800&auto=format&fit=crop', 
    'https://images.unsplash.com/photo-1522199610532-3b70572ade20?q=80&w=800&auto=format&fit=crop', 
    'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=800&auto=format&fit=crop'  
  ],
  'Daily': [
    'https://images.unsplash.com/photo-1520333789090-1afc82db536a?q=80&w=800&auto=format&fit=crop', 
    'https://images.unsplash.com/photo-1474487548417-781cb714c2f0?q=80&w=800&auto=format&fit=crop', 
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=800&auto=format&fit=crop'  
  ],
  'All': [
     'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=800&auto=format&fit=crop' 
  ]
};

export const getRandomImageForCategory = (category: string) => {
  const images = CATEGORY_IMAGES[category] || CATEGORY_IMAGES['All'];
  const randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
};

export const STORAGE_KEYS = {
  LANGUAGE: 'linguaflow_language_preference',
  DIALOGUES_LIST: 'linguaflow_saved_dialogues',
  ACTIVE_DIALOGUE_ID: 'linguaflow_active_dialogue_id',
  SESSION_PREFIX: 'linguaflow_session_'
};
// Text library for daily horoscopes. The day's theme comes from the house the transiting Moon
// occupies counted from the reader's sign (house 1 = the Moon is in their own sign).
// Each house has three body variants so consecutive visits of the Moon don't read identically.

export const HOUSE_THEMES = {
  1: {
    title: 'You, front and centre',
    focus: ['Energy', 'Mood', 'Personal goals'],
    body: [
      'The Moon is in your sign, so your own needs are harder to ignore today. Feelings run closer to the surface, which makes this a good day to start something that matters to you personally.',
      'With the Moon in your sign, people notice you more than usual. Use the attention for one clear request or one fresh start, and keep the rest of the day simple.',
      'Your instincts are louder than your to-do list today. Trust the first read on a situation, but give big reactions an hour before acting on them.',
    ],
  },
  2: {
    title: 'Money and what you value',
    focus: ['Finances', 'Food and comfort', 'Family talk'],
    body: [
      'Attention turns to money, possessions and what feels worth your effort. A small, practical step, such as reviewing one bill or one subscription, does more than a grand plan.',
      'Today favours steady, sensible choices about earning and spending. Words carry weight at home, so say the kind thing out loud.',
      'Comfort matters more than usual. Enjoy a good meal and tidy up one loose end in your finances instead of making impulse purchases.',
    ],
  },
  3: {
    title: 'Conversations and short trips',
    focus: ['Communication', 'Siblings and neighbours', 'Learning'],
    body: [
      'Messages, calls and quick errands fill the day. It is a strong day to pitch an idea, write, or clear your inbox, because your mind is quick and curious.',
      'You have more nerve than usual for the conversation you have been putting off. Keep it short and direct, and it will land better than you expect.',
      'Small efforts add up today. Reach out to a sibling, cousin or old friend, and say yes to a short trip or a new skill if one comes up.',
    ],
  },
  4: {
    title: 'Home and inner calm',
    focus: ['Home', 'Family', 'Rest'],
    body: [
      'Your attention goes to home and the people in it. Fixing, cleaning or simply being present there will settle you more than chasing outside goals.',
      'You need a quieter base today. Protect an hour for yourself, and handle any family matter gently instead of trying to win the point.',
      'Emotional comfort comes first. A call to a parent or elder, a home-cooked meal, or an early night will recharge you for the rest of the week.',
    ],
  },
  5: {
    title: 'Creativity and the heart',
    focus: ['Romance', 'Creativity', 'Children', 'Study'],
    body: [
      'A lighter, more playful mood arrives. Make room for something you enjoy for its own sake, whether a hobby, a date, or time with children.',
      'Your ideas have more spark today, so it is a good day to study, create or present. In love, a little open warmth goes further than careful hints.',
      'Luck favours the things you do wholeheartedly. Take a small, calculated chance on something you care about, and avoid gambling on things you do not.',
    ],
  },
  6: {
    title: 'Work, health and getting things in order',
    focus: ['Daily work', 'Health habits', 'Problem-solving'],
    body: [
      'This is a get-it-done day. Clear the backlog, fix the nagging problem and stick to your routine; the satisfaction comes from finishing, not starting.',
      'Pay attention to your body today. Regular meals, water and a walk will do more for your mood than pushing through tiredness.',
      'Small irritations at work are easier to solve than they look. Deal with them calmly one at a time and avoid getting pulled into arguments.',
    ],
  },
  7: {
    title: 'Partnerships',
    focus: ['Spouse or partner', 'Clients', 'Agreements'],
    body: [
      'Other people set the agenda today. Listening first will get you further than insisting, especially with a partner or an important client.',
      'One-to-one relationships are in focus. It is a good day to talk through a shared plan, sign off on an agreement, or simply spend unhurried time together.',
      'You see yourself more clearly through someone else today. Take feedback seriously without taking it personally, and offer a compromise where you can.',
    ],
  },
  8: {
    title: 'Go slow and look beneath the surface',
    focus: ['Shared money', 'Privacy', 'Rest and recovery'],
    body: [
      'Energy is lower and feelings run deep. Keep the schedule light, avoid risky decisions and arguments, and save important launches for another day.',
      'This is a day for research, review and private work, not for big public moves. Check the details on joint finances, loans or paperwork.',
      'Something hidden may come to light. Stay calm, keep sensitive matters to yourself, and be careful on the road and with your health.',
    ],
  },
  9: {
    title: 'Perspective and good fortune',
    focus: ['Learning', 'Travel', 'Mentors', 'Faith'],
    body: [
      'Your outlook widens today. Advice from a teacher, elder or mentor is worth seeking, and plans for travel or study move forward more easily.',
      'Things tend to work out with less effort than usual. Use the lift for something meaningful: a long-term plan, a prayer or practice, or a generous act.',
      'Curiosity pays off. Read, learn or explore something outside your routine, and say yes to an opportunity that stretches you a little.',
    ],
  },
  10: {
    title: 'Career and reputation',
    focus: ['Work', 'Responsibility', 'Public image'],
    body: [
      'Work takes centre stage and your effort is visible to the people who matter. Deliver what you promised and take the lead where it is offered.',
      'It is a strong day for professional matters, such as a meeting with a senior, a presentation or a decision you have been weighing. Stay composed under pressure.',
      'Responsibilities feel heavier but so does your authority. Finish the task with your name on it first, and leave personal matters for the evening.',
    ],
  },
  11: {
    title: 'Gains and friendships',
    focus: ['Income', 'Friends and networks', 'Hopes'],
    body: [
      'This is one of the easier days of the month. Help comes through friends and contacts, and a hope you have been holding moves a step closer.',
      'Group efforts and networking go well. Ask for the introduction, follow up on money owed to you, and share credit freely.',
      'Results from earlier effort start to show. Enjoy the company of friends, and note down any new idea for extra income while it is fresh.',
    ],
  },
  12: {
    title: 'Rest and letting go',
    focus: ['Rest', 'Expenses', 'Solitude'],
    body: [
      'You run on less fuel today, so guard your sleep and your spending. It is better for finishing and clearing out than for beginning.',
      'Quiet time is productive time today. Meditation, prayer, a long walk or simply being offline will do you good; avoid overcommitting.',
      'Watch for small leaks of money and energy. Close one chapter, tidy one corner, and let tomorrow handle the new plans.',
    ],
  },
};

export const TONE_LINES = {
  supportive: [
    'Helpful planetary support makes the day flow more easily, so move ahead with confidence.',
    'The mood of the day is generous. People are more willing to say yes.',
  ],
  demanding: [
    'There is some friction in the air, so allow extra time and stay patient with delays or short tempers.',
    'The day asks for discipline. Keep promises small and your temper cool.',
  ],
  steady: [
    'The overall mood of the day is even, so results depend mostly on your own effort.',
    'Nothing unusual pushes or blocks you today. A steady pace works best.',
  ],
};

export const MERCURY_RETROGRADE_LINE =
  'Mercury is retrograde, so double-check messages, travel times and anything you sign.';

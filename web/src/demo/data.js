// The sample world the clickable prototype starts from. Everyone and everything here is made up.
import generated from './generated.json';

export const SELF_ID = '11111111-1111-4111-8111-111111111111';
export const BROTHER_ID = '22222222-2222-4222-8222-222222222222';
const ago = (days, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3600 * 1000).toISOString();
const ahead = (days) => new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();

/** The people you can view the prototype as. */
export const PERSONAS = [
  { id: 'u', name: 'Asha', email: 'asha@example.com', note: 'A member with a profile, matches and a family helper. Also the admin.' },
  { id: 'h1', name: 'Sunita (Asha\'s mum)', email: 'sunita@example.com', note: 'Helps Asha through Family mode. Has no chart of her own.' },
  { id: 'h2', name: 'Rajesh (Asha\'s papa)', email: 'rajesh@example.com', note: 'Has been sent a family invite and has not accepted yet.' },
];

const man = (id, display_name, birth_year, city, work, education, height_cm, religion, community, mother_tongue, income_range, about, interests, more = {}) => ({
  user_id: id, display_name, birth_year, gender: 'man', interested_in: 'women', looking_for: 'marriage', about, height_cm, education, work, city,
  marital_status: 'never_married', diet: 'vegetarian', drinking: 'socially', smoking: 'never', interests, religion, community, mother_tongue, gotra: '',
  income_range, family_type: 'joint', parents: '', siblings: '', show_religion: true, show_community: true, show_income: true, show_online: true,
  discoverable: true, only_liked: false, created_at: ago(6), ...more,
});

export function seed() {
  const year = new Date().getFullYear();
  return {
    users: [
      ...PERSONAS.map((p) => ({ id: p.id, email: p.email, created_at: ago(20) })),
      ...['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].map((id) => ({ id, email: `${id}@example.com`, created_at: ago(6) })),
    ],
    profiles: [...PERSONAS.map((p) => ({ id: p.id, language: 'hg' }))],
    birth_profiles: [
      { id: SELF_ID, user_id: 'u', name: 'Asha', relation: null, birth_date: '1994-03-12', birth_time: '08:20:00', time_unknown: false, place_name: 'Jaipur, Rajasthan, India', latitude: 26.9124, longitude: 75.7873, timezone: 'Asia/Kolkata', is_self: true, created_at: ago(20) },
      { id: BROTHER_ID, user_id: 'u', name: 'Rohan', relation: 'Friend', birth_date: '1992-07-05', birth_time: null, time_unknown: true, place_name: 'Surat, Gujarat, India', latitude: 21.17, longitude: 72.83, timezone: 'Asia/Kolkata', is_self: false, created_at: ago(18) },
    ],
    chart_facts: [
      { birth_profile_id: SELF_ID, lagna: 'Mesha', moon: 'Kumbha', star: 'Shatabhisha' },
      { birth_profile_id: BROTHER_ID, lagna: null, moon: 'Simha', star: 'Purva Phalguni' },
    ],
    chat_messages: [],
    ai_usage: [],
    meet_profiles: [
      { user_id: 'u', display_name: 'Asha', birth_year: year - 32, gender: 'woman', interested_in: 'men', looking_for: 'marriage', about: 'I plan the trip and you get the window seat.', height_cm: 163,
        education: 'M.Des', work: 'UX researcher', city: 'Jaipur', marital_status: 'never_married', diet: 'vegetarian', drinking: 'never', smoking: 'never', interests: ['Trekking', 'Old Hindi songs', 'Chai'],
        religion: 'Hindu', community: 'Rajput', mother_tongue: 'Hindi', gotra: '', income_range: '10_15', family_type: 'nuclear', parents: 'Father is a teacher', siblings: 'One elder brother',
        show_religion: true, show_community: true, show_income: true, show_online: true, discoverable: true, only_liked: false, created_at: ago(15) },
      man('p1', 'Dev', year - 31, 'Surat', 'Product designer', 'MBA', 180, 'Hindu', 'Patel', 'Gujarati', '15_20', 'I make a serious undhiyu, and I always carry a spare charger.', ['Indie music', 'Trekking', 'Cricket'], { parents: 'Father runs a textile business', siblings: 'One younger sister' }),
      man('p2', 'Arjun', year - 34, 'Ahmedabad', 'Chartered accountant', 'CA', 175, 'Hindu', 'Rajput', 'Hindi', '20_30', 'Spreadsheets on weekdays, long drives on weekends.', ['Road trips', 'Ghazals']),
      man('p3', 'Ishaan', year - 32, 'Indore', 'Data analyst', 'B.Tech', 173, 'Hindu', '', 'Hindi', null, 'Will lose to you at chess and still ask for a rematch.', ['Chess', 'Street food', 'Podcasts'], { show_community: false, show_income: false }),
      man('p4', 'Kunal', year - 29, 'Pune', 'Software engineer', 'B.E.', 178, 'Hindu', 'Maratha', 'Marathi', '15_20', 'Morning runs, filter coffee, and too many browser tabs.', ['Running', 'Stand-up comedy', 'Board games'], { family_type: 'nuclear' }),
      man('p5', 'Neil', year - 30, 'Bengaluru', 'Doctor', 'MBBS', 176, 'Hindu', 'Brahmin', 'Kannada', '20_30', 'On call a lot, so I make the free evenings count.', ['Cooking', 'Carnatic music'], { diet: 'vegetarian', drinking: 'never' }),
      man('p6', 'Harman', year - 29, 'Chandigarh', 'Architect', 'B.Arch', 183, 'Sikh', 'Jat', 'Punjabi', '10_15', 'I sketch buildings and overfeed guests.', ['Photography', 'Bhangra', 'Hiking'], { diet: 'non_vegetarian' }),
      man('p7', 'Kabir', year - 33, 'Mumbai', 'Lawyer', 'LL.B', 174, 'Hindu', 'Kayastha', 'Hindi', '30_50', 'Court by day, old movies by night.', ['Films', 'Swimming']),
      man('p8', 'Mehul', year - 30, 'Jaipur', 'Runs a family jewellery business', 'B.Com', 172, 'Jain', 'Oswal', 'Hindi', '20_30', 'Same city as you, so the first chai is easy.', ['Badminton', 'Travel', 'Kishore Kumar'], { diet: 'jain' }),
    ],
    meet_preferences: [],
    meet_keys: Object.entries(generated.keys).map(([user_id, k]) => ({ user_id, ...k })), // Asha's own are worked out from her chart when first needed
    meet_photos: [],
    meet_likes: [
      { liker: 'u', liked: 'p1', kind: 'like', created_at: ago(2), acted_by: null }, { liker: 'p1', liked: 'u', kind: 'like', created_at: ago(2, 3), acted_by: null },
      { liker: 'p4', liked: 'u', kind: 'like', created_at: ago(1), acted_by: null }, { liker: 'p8', liked: 'u', kind: 'like', created_at: ago(1), acted_by: null },
      { liker: 'u', liked: 'p7', kind: 'pass', created_at: ago(3), acted_by: 'h1' },
    ],
    meet_messages: [
      { id: 'm1', sender: 'p1', recipient: 'u', body: 'Hi Asha! Your profile made me smile.', created_at: ago(1, 5), read_at: ago(1, 4), sent_by: null },
      { id: 'm2', sender: 'u', recipient: 'p1', body: 'Ha, thank you. What did you cook this week?', created_at: ago(1, 4), read_at: ago(1, 3), sent_by: null },
      { id: 'm3', sender: 'p1', recipient: 'u', body: 'Undhiyu, obviously. Sunday ko aa jao, taste test ho jayega.', created_at: ago(0, 2), read_at: null, sent_by: null },
    ],
    meet_blocks: [],
    meet_reports: [{ id: 'r1', reporter: 'p5', reported: 'p2', reason: 'money', details: 'Asked me to lend him money on the second day.', status: 'open', created_at: ago(1) }],
    meet_suspensions: [],
    meet_admins: [{ user_id: 'u', role: 'owner', created_at: ago(20) }],
    meet_invites: [
      { code: 'asha7k2qmnpq', inviter: 'u', created_at: ago(1), expires_at: ahead(6) },
      { code: 'neil4vibe8check', inviter: 'p5', created_at: ago(0, 6), expires_at: ahead(7) },
    ],
    meet_invite_accepts: [{ code: 'asha7k2qmnpq', invitee: 'p3', created_at: ago(0, 8) }],
    family_invites: [{ code: 'fam7k2qmnpq3', person: 'u', label: 'Papa', can_like: false, can_chat: false, created_at: ago(1), expires_at: ahead(6), used_at: null }],
    family_links: [{ person: 'u', helper: 'h1', label: 'Mum', can_like: true, can_chat: false, paused: false, created_at: ago(7) }],
    family_suggestions: [{ person: 'u', suggested: 'p8', helper: 'h1', created_at: ago(0, 20) }],
    meet_notifications: [
      { id: 'n1', user_id: 'u', kind: 'family_suggested', actor: 'h1', created_at: ago(0, 20), read_at: null },
      { id: 'n2', user_id: 'u', kind: 'invite_accepted', actor: 'p3', created_at: ago(0, 8), read_at: null },
      { id: 'n3', user_id: 'u', kind: 'match', actor: 'p1', created_at: ago(2), read_at: ago(1) },
    ],
    online: ['p1', 'p4'],
  };
}

/** A handful of places for the birth-place search. The live app searches about 135,000. */
export const PLACES = [
  ['Jaipur', 'Rajasthan', 26.9124, 75.7873], ['Surat', 'Gujarat', 21.1702, 72.8311], ['Mumbai', 'Maharashtra', 19.076, 72.8777], ['Delhi', 'Delhi', 28.6139, 77.209],
  ['Bengaluru', 'Karnataka', 12.9716, 77.5946], ['Pune', 'Maharashtra', 18.5204, 73.8567], ['Ahmedabad', 'Gujarat', 23.0225, 72.5714], ['Hyderabad', 'Telangana', 17.385, 78.4867],
  ['Chennai', 'Tamil Nadu', 13.0827, 80.2707], ['Kolkata', 'West Bengal', 22.5726, 88.3639], ['Indore', 'Madhya Pradesh', 22.7196, 75.8577], ['Chandigarh', 'Chandigarh', 30.7333, 76.7794],
  ['Lucknow', 'Uttar Pradesh', 26.8467, 80.9462], ['Patna', 'Bihar', 25.5941, 85.1376], ['Gopalganj', 'Bihar', 26.4683, 84.4366], ['Rajkot', 'Gujarat', 22.3039, 70.8022],
  ['Kochi', 'Kerala', 9.9312, 76.2673], ['Bhopal', 'Madhya Pradesh', 23.2599, 77.4126], ['Nagpur', 'Maharashtra', 21.1458, 79.0882], ['Varanasi', 'Uttar Pradesh', 25.3176, 82.9739],
];

export const REPLIES = [
  'Haha, achha sawaal hai! Ek minute, sochne do.',
  'Sunday ko ghar par chill, obviously. Tum?',
  'Aajkal purane Kishore Kumar repeat par hain.',
  'Nice! Waise tumhari profile padh kar hi smile aa gayi thi.',
  'Coffee this weekend? Ya pehle thodi aur chat?',
];

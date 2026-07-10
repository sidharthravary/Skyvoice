import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import './setup-dns';
import mongoose from 'mongoose';
import { Appointment } from '../src/models/appointment.model';
import { KnowledgeBase } from '../src/models/knowledgeBase.model';
import { Conversation } from '../src/models/conversation.model';

function ddmmyyyy(s: string): Date {
  const [d, m, y] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

// ── Appointments ──────────────────────────────────────────────────────────────

const APPOINTMENTS = [
  {
    userId: 'team-internal', visitorName: 'Arjun Menon', name: 'Arjun Menon',
    date: ddmmyyyy('15-06-2026'), time: '09:30', status: 'confirmed' as const,
    notes: 'AgriVision Q2 progress review — discuss crop detection model accuracy improvements and field deployment timeline',
    calendarEventId: 'evt_001', timezone: 'IST',
  },
  {
    userId: 'team-internal', visitorName: 'Priya Nair', name: 'Priya Nair',
    date: ddmmyyyy('15-06-2026'), time: '14:00', status: 'confirmed' as const,
    notes: 'New client onboarding — Kerala State Agricultural Department — initial requirements gathering for drone monitoring system',
    calendarEventId: 'evt_002', timezone: 'IST',
  },
  {
    userId: 'team-internal', visitorName: 'Rahul Sharma', name: 'Rahul Sharma',
    date: ddmmyyyy('16-06-2026'), time: '11:00', status: 'confirmed' as const,
    notes: 'AerionAI sprint planning — UAV autonomous navigation module — Week 3 milestone review',
    calendarEventId: 'evt_003', timezone: 'IST',
  },
  {
    userId: 'team-internal', visitorName: 'Divya Krishnan', name: 'Divya Krishnan',
    date: ddmmyyyy('16-06-2026'), time: '15:30', status: 'pending' as const,
    notes: 'Airspace Intelligence demo for ISRO liaison team — awaiting confirmation from client side',
    calendarEventId: 'evt_004', timezone: 'IST',
  },
  {
    userId: 'team-internal', visitorName: 'Sanjay Pillai', name: 'Sanjay Pillai',
    date: ddmmyyyy('17-06-2026'), time: '10:00', status: 'confirmed' as const,
    notes: 'SupplyChain AI weekly sync — route optimization engine performance metrics and anomaly detection pipeline update',
    calendarEventId: 'evt_005', timezone: 'IST',
  },
  {
    userId: 'team-internal', visitorName: 'Meera Thomas', name: 'Meera Thomas',
    date: ddmmyyyy('18-06-2026'), time: '13:00', status: 'confirmed' as const,
    notes: 'Investor update call — Series A discussion — presenting Q2 metrics, ARR growth, and product roadmap',
    calendarEventId: 'evt_006', timezone: 'IST',
  },
  {
    userId: 'team-internal', visitorName: 'Kiran Raj', name: 'Kiran Raj',
    date: ddmmyyyy('19-06-2026'), time: '09:00', status: 'confirmed' as const,
    notes: 'Team all-hands — June sprint retrospective and July planning — all departments',
    calendarEventId: 'evt_007', timezone: 'IST',
  },
  {
    userId: 'team-internal', visitorName: 'Ananya Suresh', name: 'Ananya Suresh',
    date: ddmmyyyy('19-06-2026'), time: '16:00', status: 'cancelled' as const,
    notes: 'AgriVision field deployment site visit — Wayanad — postponed due to weather conditions',
    calendarEventId: 'evt_008', timezone: 'IST',
  },
];

// ── KnowledgeBase seed documents ──────────────────────────────────────────────

const KB_DOCS = [
  {
    title: 'AgriVision Project — Current Status',
    content: 'AgriVision is Skyvion Technologies\' flagship precision agriculture platform using drone-based multispectral imaging and AI crop analysis. Current status as of June 2026: The crop disease detection model has reached 94.2% accuracy on test datasets, up from 89% last quarter. The team is working on improving inference speed for edge deployment on field drones. Two pending tasks this week: finalizing the Karnataka pilot deployment documentation and completing the integration with the state agricultural department\'s data portal. The field deployment in Wayanad has been postponed due to weather. Next milestone: full Karnataka state rollout by July 15, 2026. Budget utilization: 67% of Q2 allocation used. Team lead: Arjun Menon.',
    sourceType: 'seed' as const, indexStatus: 'indexed' as const, embedding: [],
  },
  {
    title: 'AerionAI Project — Current Status',
    content: 'AerionAI is Skyvion\'s autonomous UAV intelligence platform for urban air mobility and drone traffic management. Current status as of June 2026: Sprint 3 is in progress. The autonomous navigation module is 78% complete. Key pending items: obstacle avoidance algorithm testing in simulation environment (due June 18), integration with ATC communication protocols (due June 25), and safety certification documentation submission (due June 30). A sprint planning meeting is scheduled with Rahul Sharma on June 16 at 11 AM. The ISRO liaison demo is pending client confirmation for June 16. Risk: simulation environment setup is 2 days behind schedule. Team lead: Rahul Sharma. Overall project completion: 61%.',
    sourceType: 'seed' as const, indexStatus: 'indexed' as const, embedding: [],
  },
  {
    title: 'Airspace Intelligence Platform — Current Status',
    content: 'Airspace Intelligence is Skyvion\'s real-time airspace monitoring and conflict detection system for civil aviation authorities. Current status as of June 2026: The platform is in beta with 3 active pilot customers. Pending this week: ISRO demo preparation (June 16, awaiting client confirmation), conflict detection algorithm v2.3 peer review, and integration testing with FlightRadar data feeds. One open bug: radar data ingestion latency spikes above 200ms during peak hours — assigned to backend team, expected fix by June 17. The product is on track for commercial launch in Q3 2026. Monthly active airspace zones monitored: 47. Team lead: Divya Krishnan.',
    sourceType: 'seed' as const, indexStatus: 'indexed' as const, embedding: [],
  },
  {
    title: 'SupplyChain AI — Current Status',
    content: 'SupplyChain AI is Skyvion\'s intelligent logistics optimization platform using predictive analytics and route optimization. Current status as of June 2026: The route optimization engine is live with 2 enterprise clients — LogiCorp India and FreshMart Retail. This week\'s sync with Sanjay Pillai on June 17 at 10 AM covers: performance metrics showing 23% reduction in delivery times for LogiCorp, anomaly detection pipeline catching 94% of shipment delays proactively, and new feature request from FreshMart for cold-chain temperature monitoring integration. Pending development tasks: cold chain module architecture design (due June 20), API documentation update for v2 client SDK (due June 19). Revenue contribution: 34% of current ARR. Team lead: Sanjay Pillai.',
    sourceType: 'seed' as const, indexStatus: 'indexed' as const, embedding: [],
  },
  {
    title: "This Week's Schedule and Priorities — Week of June 15 2026",
    content: 'This week at Skyvion Technologies, June 15 to 21, 2026. Monday June 15: AgriVision Q2 review with Arjun Menon at 9:30 AM, New client onboarding with Kerala Agricultural Department at 2 PM. Tuesday June 16: AerionAI sprint planning with Rahul Sharma at 11 AM, Airspace Intelligence ISRO demo at 3:30 PM (pending confirmation). Wednesday June 17: SupplyChain AI weekly sync with Sanjay Pillai at 10 AM. Thursday June 18: Investor update call with Meera Thomas at 1 PM — Series A discussion. Friday June 19: Team all-hands at 9 AM for June retrospective and July planning. The Wayanad field visit originally scheduled Friday has been cancelled. Top 3 priorities this week: 1) Complete AerionAI obstacle avoidance testing, 2) Finalize investor deck for Thursday call, 3) Fix Airspace Intelligence radar latency bug.',
    sourceType: 'seed' as const, indexStatus: 'indexed' as const, embedding: [],
  },
  {
    title: 'Pending Tasks and Blockers — June 2026',
    content: 'Open pending tasks across all projects as of June 15, 2026. AgriVision: Karnataka deployment documentation (owner: Arjun Menon, due June 17), state portal integration completion (due June 20). AerionAI: obstacle avoidance simulation testing (due June 18, at risk — 2 days delayed), safety certification docs (due June 30), ATC protocol integration (due June 25). Airspace Intelligence: radar latency bug fix (due June 17), ISRO demo slide deck (due June 15 EOD), conflict detection v2.3 peer review (due June 19). SupplyChain AI: cold chain module design (due June 20), v2 SDK documentation (due June 19). Company-wide: investor presentation deck (due June 17), Q2 financial report draft (due June 18). Active blockers: AerionAI simulation environment setup delayed by DevOps dependency, Airspace Intelligence radar bug requires vendor API access pending approval.',
    sourceType: 'seed' as const, indexStatus: 'indexed' as const, embedding: [],
  },
  {
    title: 'Team and Company Overview — June 2026',
    content: 'Skyvion Technologies is an aerospace and AI company based in Trivandrum, Kerala, India. Founded to build intelligent systems for aerospace, agriculture, and logistics. Current team size: 24 full-time employees across engineering, AI research, product, and operations. Active products: AgriVision (precision agriculture), AerionAI (autonomous UAV), Airspace Intelligence (airspace monitoring), SupplyChain AI (logistics optimization). Current clients: 6 enterprise clients across agriculture, aviation, and logistics verticals. Q2 2026 metrics: 94% average AI model accuracy across products, 23% average operational efficiency improvement delivered to clients, ARR growing at 18% month-over-month. Upcoming: Series A investor call June 18, Q3 product launches planned for AerionAI and Airspace Intelligence commercial release.',
    sourceType: 'seed' as const, indexStatus: 'indexed' as const, embedding: [],
  },
  {
    title: 'Meeting Outcomes and Action Items — Last Week',
    content: 'Summary of last week June 8 to 14 2026 at Skyvion Technologies. AgriVision: Completed model retraining with new dataset — accuracy improved from 89% to 94.2%. Decision: proceed with Karnataka pilot. AerionAI: Completed navigation module design phase, entered implementation sprint. Risk flagged: simulation environment setup behind by 2 days. Airspace Intelligence: Shipped v2.2 with improved conflict resolution logic. Bug found in radar ingestion — being fixed this week. SupplyChain AI: LogiCorp reported 23% delivery time reduction — positive client feedback. FreshMart requested cold chain feature. Company: Completed Q2 financial review — on track. Investor deck work started. HR: 2 new AI engineers joining July 1.',
    sourceType: 'seed' as const, indexStatus: 'indexed' as const, embedding: [],
  },
];

// ── Conversations ─────────────────────────────────────────────────────────────

const CONVERSATIONS = [
  {
    userId: 'visitor-001',
    messages: [
      { role: 'user' as const,      content: "Hi, I'd like to schedule a meeting to discuss drone solutions for our farm",                                                                              timestamp: new Date('2026-06-13T09:15:00Z') },
      { role: 'assistant' as const, content: "Hello! I'd be happy to help schedule a meeting about our AgriVision drone solutions. Could I get your name and the best date that works for you?",         timestamp: new Date('2026-06-13T09:15:05Z') },
      { role: 'user' as const,      content: "I'm Priya Nair from Kerala Agricultural Department. Can we do Monday June 15 at 2 PM?",                                                                  timestamp: new Date('2026-06-13T09:15:30Z') },
      { role: 'assistant' as const, content: "Perfect, Priya! I've booked you in for Monday June 15th at 2 PM. You'll receive a confirmation shortly. We look forward to speaking with you about AgriVision.", timestamp: new Date('2026-06-13T09:15:38Z') },
    ],
    intent: 'booking_request' as const, sentiment: 'positive' as const, resolved: true,
    createdAt: new Date('2026-06-13T09:15:00Z'),
  },
  {
    userId: 'visitor-002',
    messages: [
      { role: 'user' as const,      content: 'What kind of AI solutions does Skyvion offer for logistics?',                                                                                                                          timestamp: new Date('2026-06-12T14:30:00Z') },
      { role: 'assistant' as const, content: "Skyvion's SupplyChain AI platform uses predictive analytics and intelligent route optimization to reduce delivery times and proactively detect shipment delays. Our enterprise clients have seen up to 23% reduction in delivery times. Would you like to know more or schedule a demo?", timestamp: new Date('2026-06-12T14:30:08Z') },
      { role: 'user' as const,      content: 'That sounds great, can you tell me about pricing?',                                                                                                                                    timestamp: new Date('2026-06-12T14:31:00Z') },
      { role: 'assistant' as const, content: 'Pricing is customized based on your logistics volume and requirements. I can connect you with our team for a detailed proposal. Would you like me to collect your project details?',   timestamp: new Date('2026-06-12T14:31:06Z') },
    ],
    intent: 'general_query' as const, sentiment: 'positive' as const, resolved: false,
    createdAt: new Date('2026-06-12T14:30:00Z'),
  },
  {
    userId: 'visitor-003',
    messages: [
      { role: 'user' as const,      content: 'I need help understanding how your airspace monitoring system works',                                                                                                                                                                    timestamp: new Date('2026-06-11T11:00:00Z') },
      { role: 'assistant' as const, content: "Skyvion's Airspace Intelligence platform provides real-time monitoring and conflict detection for civil aviation. It integrates with existing radar feeds and uses AI to detect airspace conflicts before they become safety issues. It's currently in beta with aviation authorities. Would you like to schedule a technical demo?", timestamp: new Date('2026-06-11T11:00:09Z') },
      { role: 'user' as const,      content: 'Yes please, we are from ISRO',                                                                                                                                                                                                           timestamp: new Date('2026-06-11T11:01:00Z') },
      { role: 'assistant' as const, content: "Excellent! I've noted your interest from ISRO. Let me collect your details and our team will reach out to confirm a demo session tailored for your requirements.",                                                                         timestamp: new Date('2026-06-11T11:01:07Z') },
    ],
    intent: 'project_inquiry' as const, sentiment: 'positive' as const, resolved: true,
    createdAt: new Date('2026-06-11T11:00:00Z'),
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function seedAll() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('✅ Connected to Atlas\n');

  // ── Appointments (upsert by calendarEventId) ──
  for (const appt of APPOINTMENTS) {
    await Appointment.updateOne(
      { calendarEventId: appt.calendarEventId },
      { $set: appt },
      { upsert: true }
    );
  }
  const apptCount = await Appointment.countDocuments({ userId: 'team-internal' });
  console.log(`✅ Appointments seeded: ${apptCount} documents`);

  // ── KnowledgeBase (upsert by title) ──
  for (const doc of KB_DOCS) {
    await KnowledgeBase.updateOne(
      { title: doc.title },
      { $set: doc },
      { upsert: true }
    );
  }
  const kbCount = await KnowledgeBase.countDocuments({ sourceType: 'seed' });
  console.log(`✅ KnowledgeBase seeded: ${kbCount} documents`);

  // ── Conversations (upsert by userId) ──
  for (const conv of CONVERSATIONS) {
    await Conversation.updateOne(
      { userId: conv.userId },
      { $set: conv },
      { upsert: true }
    );
  }
  const convCount = await Conversation.countDocuments({ userId: { $in: ['visitor-001', 'visitor-002', 'visitor-003'] } });
  console.log(`✅ Conversations seeded: ${convCount} documents`);

  console.log('\n🚀 All collections seeded successfully');
  await mongoose.disconnect();
}

seedAll().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});

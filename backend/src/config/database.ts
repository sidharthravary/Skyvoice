import dns from 'dns';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { KnowledgeBase } from '../models/knowledgeBase.model';
import { User } from '../models/user.model';

// Belt-and-suspenders: ensure .env is loaded even if server.ts dotenv call raced ahead.
// dotenv.config() is idempotent — existing process.env values are never overwritten.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// c-ares (used by Node.js dns.resolve*) doesn't auto-detect the system DNS on some
// Windows configurations. Read the router/DNS from the env or fall back to the
// well-known public resolvers so Atlas SRV lookups succeed.
const DNS_SERVERS = (process.env.DNS_SERVERS || '192.168.1.1,8.8.8.8,1.1.1.1').split(',').map(s => s.trim()).filter(Boolean);
dns.setServers(DNS_SERVERS);

async function seedKnowledgeBase() {
  try {
    // Clean old Skyvion Technologies documents to force refresh with latest details
    await KnowledgeBase.deleteMany({ title: { $regex: 'Skyvion Technologies' } });

    const companyDocs = [
      {
        title: "Skyvion Technologies Mission, Core Philosophy, and Origins",
        content: "Skyvion Technologies is an AI-powered technology company based in Trivandrum (Thiruvananthapuram), Kerala, India, operating as a Limited Liability Partnership (LLP). Siting at the intersection of aerospace, agriculture, and supply chain management, the company is unified by a core competency in artificial intelligence, machine learning, and advanced data analytics. Skyvion's mission is to pioneer a new generation of intelligent solutions designed to seamlessly integrate autonomous systems into modern operations, ensuring drones, satellites, and autonomous platforms operate safely and efficiently. The name 'Skyvion' is a portmanteau of 'sky' and 'vision', representing their ability to analyze data from the skies to generate actionable intelligence. Their tagline is 'Innovation at every altitude'. They follow a safety-first design philosophy, emphasizing comprehensive risk analysis and mitigation, real-time processing for instant insights and adaptive responses, and a scalable architecture supporting everything from pilot projects to full enterprise deployment.",
        sourceType: "manual" as const,
        indexStatus: "indexed" as const,
      },
      {
        title: "Skyvion Technologies Enterprise Tech Stack & AI/ML Foundation",
        content: "Skyvion Technologies uses a modern, enterprise-grade AI and Remote Sensing tech stack. Their AI/ML frameworks include TensorFlow, PyTorch, LangChain, and OpenAI integrations. For Remote Sensing and Earth Observation, they work with satellite datasets including Sentinel-2, Landsat, PACE, and Google Earth Engine (GEE). Their backend infrastructure is built on FastAPI, PostgreSQL, MongoDB, and Redis. For cloud and DevOps, they deploy on AWS, containerized with Docker, orchestrated via Kubernetes, and provisioned using Terraform. This production-grade stack is built for scale, performance, and operational reliability.",
        sourceType: "manual" as const,
        indexStatus: "indexed" as const,
      },
      {
        title: "Skyvion Technologies Core Solutions: Data Analytics, Risk, and AI",
        content: "Skyvion Technologies provides four broad solution categories: 1) Advanced Data Analytics: Processing and analyzing complex UAV (unmanned aerial vehicle) datasets with advanced image processing, remote sensing interpretation, and geospatial analysis to transform raw satellite and drone feeds into structured intelligence. 2) Risk Analysis & Safety: Applying AI and ML models to identify, evaluate, and mitigate potential hazards in autonomous operations, with a focus on regulatory compliance and safety risk mitigation. 3) Intelligent Software Engines: Developing advanced AI/ML algorithms that serve as secure, reliable, autonomous navigation and decision-making brains for UAVs. 4) AI Integration: Seamlessly integrating artificial intelligence models into existing enterprise platforms to improve data interpretation, operational efficiency, and mission outcomes.",
        sourceType: "manual" as const,
        indexStatus: "indexed" as const,
      },
      {
        title: "Skyvion Technologies Flagship Products: Airspace Intelligence & AgriVision",
        content: "Skyvion Technologies has four flagship products. 1) Airspace Intelligence is an advanced predictive coordination and airspace intelligence platform that enables seamless UAV integration into modern airspace through predictive modeling. It maps a pipeline from data ingestion to LLM analysis, optimization, and safe operations, featuring real-time drone traffic prediction, AI-powered route optimization, and adaptive flight coordination as an air traffic management system for drones. 2) AgriVision transforms satellite imagery into agricultural intelligence using advanced remote sensing. It leverages high-resolution satellite imagery and indices like NDVI (Normalized Difference Vegetation Index) and EVI (Enhanced Vegetation Index) combined with ML forecasts to provide crop vegetation health monitoring, yield prediction models, and alerts for drought and pests.",
        sourceType: "manual" as const,
        indexStatus: "indexed" as const,
      },
      {
        title: "Skyvion Technologies Flagship Products: AerionAI & SupplyChain AI",
        content: "Skyvion Technologies products include: 1) AerionAI: An intelligent resource planning agent and decision-support platform for complex aerospace operations. It features multi-agent coordination, LLM-based explanations, and what-if scenario planning spanning fleet management, mission planning, facilities, and risk assessment. 2) SupplyChain AI: Moves organizations from reactive firefighting to proactive orchestration via autonomous agents and ML forecasts. It integrates signals from weather, holidays, news, and LLMs to generate ETA predictions and risk alerts with APIs built on FastAPI, webhooks, and Role-Based Access Control (RBAC). It achieves a 15%+ reduction in late orders, P95 latency under 500ms, and a full audit trail. Skyvion claims a prediction accuracy of 98.7%, targeting industry leaders across aerospace, agritech, and logistics.",
        sourceType: "manual" as const,
        indexStatus: "indexed" as const,
      }
    ];

    await KnowledgeBase.insertMany(companyDocs);
    console.log('🌱 Seeded KnowledgeBase collection successfully with 5 updated Skyvion Technologies documents');
  } catch (error) {
    console.error('❌ Failed to seed KnowledgeBase:', error);
  }
}

async function seedAdminUser(): Promise<void> {
  try {
    const exists = await User.findOne({ username: 'Admin' });
    if (!exists) {
      const hash = await bcrypt.hash('Skyvoice', 10);
      await User.create({ username: 'Admin', passwordHash: hash, role: 'admin' });
      console.log('🌱 Admin user seeded (username: Admin, password: Skyvoice)');
    }
  } catch (error) {
    console.error('❌ Failed to seed Admin user:', error);
  }
}

export async function connectDatabase(): Promise<void> {
  // Read URI here (inside the function) so dotenv is guaranteed to have run.
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/skyvoice';

  const isAtlas = MONGODB_URI.includes('mongodb+srv');
  const maskedUri = MONGODB_URI.replace(/:([^:@]+)@/, ':***@');
  console.log(`[DB] Connecting to ${isAtlas ? 'Atlas' : 'localhost'}: ${maskedUri}`);

  try {
    await mongoose.connect(MONGODB_URI);

    const { host, name } = mongoose.connection;
    console.log(`✅ MongoDB connected — host: ${host}, db: ${name}`);

    // Run knowledge base seeding
    await seedKnowledgeBase();

    // Seed Admin user
    await seedAdminUser();

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Attempting reconnect...');
    });
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

export default mongoose;

import { UserSession } from '../models/userSession.model';

export async function trackLogin(userId: string, username: string, fullName: string): Promise<void> {
  try {
    await UserSession.findOneAndUpdate(
      { userId },
      {
        $set:  { username, fullName, lastActive: new Date() },
        $inc:  { totalSessions: 1 },
        $push: { activityLog: { type: 'login', timestamp: new Date(), details: { loginTime: new Date() } } },
        $setOnInsert: { firstLogin: new Date() },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('[UserSession] trackLogin error:', err);
  }
}

export async function trackVoiceQuery(
  userId: string,
  userMessage: string,
  aiResponse: string,
  intent: string
): Promise<void> {
  try {
    await UserSession.findOneAndUpdate(
      { userId },
      {
        $set:  { lastActive: new Date() },
        $inc:  { totalMessages: 1 },
        $push: {
          activityLog: {
            type: 'voice_query',
            timestamp: new Date(),
            userMessage,
            aiResponse,
            intent,
            resolved: true,
          },
        },
      }
    );
  } catch (err) {
    console.error('[UserSession] trackVoiceQuery error:', err);
  }
}

export async function trackBooking(
  userId: string,
  appointment: { _id: unknown; date: unknown; time: string; notes?: string }
): Promise<void> {
  try {
    await UserSession.findOneAndUpdate(
      { userId },
      {
        $inc:  { totalBookings: 1 },
        $push: {
          activityLog: {
            type: 'booking_created',
            timestamp: new Date(),
            details: {
              date:          appointment.date,
              time:          appointment.time,
              notes:         appointment.notes,
              appointmentId: String(appointment._id),
            },
          },
          appointments: appointment._id,
        },
      }
    );
  } catch (err) {
    console.error('[UserSession] trackBooking error:', err);
  }
}

export async function trackProjectUpdate(
  userId: string,
  projectName: string,
  previousStatus: string,
  newStatus: string,
  note: string
): Promise<void> {
  try {
    const updateEntry = {
      timestamp:      new Date(),
      previousStatus,
      newStatus,
      updatedBy:      userId,
      note:           note || '',
    };

    // Push activity log entry regardless
    await UserSession.findOneAndUpdate(
      { userId },
      {
        $push: {
          activityLog: {
            type: 'project_update',
            timestamp: new Date(),
            details: { projectName, previousStatus, newStatus, note },
          },
        },
      }
    );

    // Update existing project interaction
    const updated = await UserSession.findOneAndUpdate(
      { userId, 'projectInteractions.projectName': projectName },
      {
        $set:  { 'projectInteractions.$.lastUpdated': new Date() },
        $push: { 'projectInteractions.$.updatesLog': updateEntry },
      }
    );

    // If project not tracked yet for this user, add it
    if (!updated) {
      await UserSession.findOneAndUpdate(
        { userId },
        {
          $push: {
            projectInteractions: {
              projectName,
              lastQueried: new Date(),
              lastUpdated: new Date(),
              updatesLog:  [updateEntry],
            },
          },
        }
      );
    }
  } catch (err) {
    console.error('[UserSession] trackProjectUpdate error:', err);
  }
}

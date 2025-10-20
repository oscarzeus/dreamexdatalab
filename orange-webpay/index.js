/**
 * Firebase Cloud Functions for Dreamex Data Lab
 * Automated Report Scheduling and Delivery
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Initialize Firebase Admin
admin.initializeApp();

// Expose Orange Money WebPay API as an HTTPS function for a permanent URL
exports.orangePay = require('./orangePay');

/**
 * Callable function to create a Firebase Auth user for an existing DB-only profile.
 * This allows converting a reporting-only user (no authUid) to a full account without
 * signing out the admin in the client app.
 *
 * Security:
 * - Requires authenticated caller.
 * - Verifies the caller has admin rights in the provided companyId path.
 * - Creates the auth user with the specified uid to preserve existing references.
 */
exports.createAuthUser = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const { uid, email, password, displayName, companyId } = data || {};

    if (!uid || !email || !password || !companyId) {
      throw new functions.https.HttpsError('invalid-argument', 'uid, email, password, and companyId are required.');
    }

    if (typeof email !== 'string' || typeof password !== 'string' || typeof uid !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid parameter types.');
    }

    // Basic password validation on server-side too
    if (password.length < 6) {
      throw new functions.https.HttpsError('failed-precondition', 'Password must be at least 6 characters long.');
    }

    const db = admin.database();

    // Verify caller has admin privileges in the target company
    const callerId = context.auth.uid;
    const callerPath = `companies/${companyId}/users/${callerId}`;
    const callerSnap = await db.ref(callerPath).once('value');
    const callerData = callerSnap.val();

    const isCompanyAdmin = !!(callerData && (callerData.isCompanyAdmin || callerData.isAdmin));
    if (!isCompanyAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Only company admins can convert users to real accounts.');
    }

    // Try to create the auth user with specified uid (to preserve references)
    let createdUserRecord = null;
    try {
      createdUserRecord = await admin.auth().createUser({
        uid,
        email,
        password,
        displayName: displayName || undefined,
        emailVerified: false,
        disabled: false,
      });
    } catch (err) {
      // If user with uid already exists, throw a descriptive error
      if (err && err.code === 'auth/uid-already-exists') {
        throw new functions.https.HttpsError('already-exists', 'An auth user with this UID already exists.');
      }
      if (err && err.code === 'auth/email-already-exists') {
        throw new functions.https.HttpsError('already-exists', 'Email is already in use by another account.');
      }
      console.error('Error creating auth user:', err);
      throw new functions.https.HttpsError('internal', 'Failed to create auth user.');
    }

    // Update database flags for this user (global and company paths)
    const userUpdate = {
      authUid: uid,
      reportingOnly: false,
      canSignIn: true,
      accountType: 'with-account',
      emailVerified: false,
      lastUpdated: new Date().toISOString(),
    };

    await Promise.all([
      db.ref(`users/${uid}`).update(userUpdate),
      db.ref(`companies/${companyId}/users/${uid}`).update(userUpdate),
    ]);

    return { success: true, uid: createdUserRecord.uid };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error('createAuthUser error:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Unknown error');
  }
});

/**
 * Scheduled function that runs every minute to check for pending reports
 * Cron schedule: every minute
 */
exports.checkScheduledReports = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('Africa/Johannesburg') // Adjust to your timezone
  .onRun(async (context) => {
    console.log('🔍 Checking for scheduled reports to send...');
    
    const now = Date.now();
    const db = admin.database();
    
    try {
      // Check fueldist scheduled reports
      const fuelDistReports = await checkAndSendReports(
        db,
        'scheduledReports/fueldist',
        'fueldist',
        now
      );
      
      // You can add more report types here
      // const otherReports = await checkAndSendReports(db, 'scheduledReports/other', 'other', now);
      
      console.log(`✅ Processed ${fuelDistReports} fuel distribution reports`);
      
    } catch (error) {
      console.error('❌ Error checking scheduled reports:', error);
    }
    
    return null;
  });

/**
 * Check and send reports for a specific report type
 */
async function checkAndSendReports(db, schedulePath, reportType, now) {
  let processedCount = 0;
  
  // Get all companies
  const companiesSnapshot = await db.ref(schedulePath).once('value');
  const companies = companiesSnapshot.val();
  
  if (!companies) {
    console.log(`No scheduled reports found for ${reportType}`);
    return 0;
  }
  
  // Process each company
  for (const [companyId, companySchedules] of Object.entries(companies)) {
    if (!companySchedules) continue;
    
    for (const [scheduleId, schedule] of Object.entries(companySchedules)) {
      if (!schedule || schedule.status === 'sent' || schedule.status === 'cancelled') {
        continue;
      }
      
      // Check if it's time to send
      const startTime = new Date(schedule.startOn).getTime();
      const timeDiff = now - startTime;
      
      // Send if within 2 minutes of scheduled time (allows for function execution delay)
      if (timeDiff >= 0 && timeDiff <= 120000) {
        console.log(`📧 Sending scheduled report: ${scheduleId} for company ${companyId}`);
        
        try {
          await sendScheduledReport(db, schedule, scheduleId, companyId, reportType);
          processedCount++;
        } catch (error) {
          console.error(`❌ Error sending report ${scheduleId}:`, error);
          
          // Update status to error
          await db.ref(`${schedulePath}/${companyId}/${scheduleId}`).update({
            status: 'error',
            error: error.message,
            lastAttempt: admin.database.ServerValue.TIMESTAMP
          });
        }
      }
    }
  }
  
  return processedCount;
}

/**
 * Send a scheduled report
 */
async function sendScheduledReport(db, schedule, scheduleId, companyId, reportType) {
  console.log(`Processing report ${scheduleId}:`, {
    title: schedule.title,
    recipients: schedule.recipients?.length || 0,
    frequency: schedule.frequency
  });
  
  // Generate the report data (you'll need to fetch this from your database)
  const reportData = await fetchReportData(db, schedule, companyId, reportType);
  
  if (!reportData) {
    throw new Error('Failed to fetch report data');
  }
  
  // Send email via EmailJS
  const emailSent = await sendReportEmail(schedule, reportData);
  
  if (emailSent) {
    // Update status to sent
    const updatePath = `scheduledReports/${reportType}/${companyId}/${scheduleId}`;
    await db.ref(updatePath).update({
      status: 'sent',
      lastSent: admin.database.ServerValue.TIMESTAMP,
      sentCount: (schedule.sentCount || 0) + 1
    });
    
    // If it's recurring, schedule next execution
    if (schedule.frequency !== 'once') {
      const nextDate = calculateNextScheduleDate(schedule.startOn, schedule.frequency);
      await db.ref(updatePath).update({
        startOn: nextDate,
        status: 'pending'
      });
      
      console.log(`✅ Recurring report rescheduled for: ${new Date(nextDate).toISOString()}`);
    }
    
    console.log(`✅ Report ${scheduleId} sent successfully`);
  } else {
    throw new Error('Failed to send email');
  }
}

/**
 * Fetch report data from database
 */
async function fetchReportData(db, schedule, companyId, reportType) {
  try {
    // Fetch analysis data based on the schedule configuration
    // This depends on your data structure
    
    if (reportType === 'fueldist') {
      // Example: Fetch fuel distribution data
      const analysisPath = `reports/${reportType}/${companyId}`;
      const snapshot = await db.ref(analysisPath).once('value');
      const data = snapshot.val();
      
      // Filter data based on schedule date range if applicable
      // You may need to adjust this based on your data structure
      
      return {
        type: reportType,
        companyId: companyId,
        data: data,
        dateRange: schedule.dateRange || {},
        title: schedule.title
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching report data:', error);
    return null;
  }
}

/**
 * Send report via EmailJS
 */
async function sendReportEmail(schedule, reportData) {
  try {
    // EmailJS configuration
    const EMAILJS_SERVICE_ID = 'service_dreamex'; // Replace with your service ID
    const EMAILJS_TEMPLATE_ID = 'template_reports'; // Replace with your template ID
    const EMAILJS_PUBLIC_KEY = 'fHs6oaqQgkcPoUwpv'; // Your existing public key
    
    // Prepare email data
    const emailData = {
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email: schedule.recipients.join(','),
        subject: schedule.title,
        message: `Your scheduled report "${schedule.title}" is ready.`,
        report_title: schedule.title,
        report_date: new Date().toLocaleDateString(),
        frequency: schedule.frequency,
        // Add more parameters as needed for your email template
      }
    };
    
    // Send via EmailJS REST API
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });
    
    if (response.ok) {
      console.log('✅ Email sent successfully via EmailJS');
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ EmailJS error:', errorText);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return false;
  }
}

/**
 * Calculate next schedule date for recurring reports
 */
function calculateNextScheduleDate(currentDate, frequency) {
  const date = new Date(currentDate);
  
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    default:
      return null;
  }
  
  return date.toISOString();
}

/**
 * HTTP endpoint to manually trigger report sending (for testing)
 */
exports.sendReportNow = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  
  try {
    const { scheduleId, companyId, reportType } = req.body;
    
    if (!scheduleId || !companyId || !reportType) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    
    const db = admin.database();
    const schedulePath = `scheduledReports/${reportType}/${companyId}/${scheduleId}`;
    const scheduleSnapshot = await db.ref(schedulePath).once('value');
    const schedule = scheduleSnapshot.val();
    
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    
    await sendScheduledReport(db, schedule, scheduleId, companyId, reportType);
    
    res.status(200).json({ 
      success: true, 
      message: 'Report sent successfully' 
    });
    
  } catch (error) {
    console.error('Error in sendReportNow:', error);
    res.status(500).json({ 
      error: 'Failed to send report', 
      details: error.message 
    });
  }
});

/**
 * Delete old sent reports (cleanup job)
 * Runs daily at midnight
 */
exports.cleanupOldReports = functions.pubsub
  .schedule('every day 00:00')
  .timeZone('Africa/Johannesburg')
  .onRun(async (context) => {
    console.log('🧹 Cleaning up old sent reports...');
    
    const db = admin.database();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    try {
      // Clean up fuel distribution reports
      const fuelDistPath = 'scheduledReports/fueldist';
      const snapshot = await db.ref(fuelDistPath).once('value');
      const companies = snapshot.val();
      
      let deletedCount = 0;
      
      if (companies) {
        for (const [companyId, schedules] of Object.entries(companies)) {
          for (const [scheduleId, schedule] of Object.entries(schedules)) {
            // Delete if sent more than 30 days ago and is one-time report
            if (
              schedule.status === 'sent' && 
              schedule.frequency === 'once' &&
              schedule.lastSent < thirtyDaysAgo
            ) {
              await db.ref(`${fuelDistPath}/${companyId}/${scheduleId}`).remove();
              deletedCount++;
            }
          }
        }
      }
      
      console.log(`✅ Deleted ${deletedCount} old reports`);
      
    } catch (error) {
      console.error('❌ Error cleaning up reports:', error);
    }
    
    return null;
  });

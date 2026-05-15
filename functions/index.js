// ═══════════════════════════════════════════════
// functions/index.js — Firebase Cloud Functions (1st gen)
// MaintainPro — Push Notification Dispatcher
// Uses v1 functions — no Artifact Registry or Cloud Build needed
// ═══════════════════════════════════════════════

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

admin.initializeApp();

// ── Triggered when a new notification doc is created ──
exports.sendPushNotification = functions.firestore
  .document('notifications/{docId}')
  .onCreate(async (snap, context) => {

    const data  = snap.data();
    const toUid = data.toUid;
    const title = data.title || 'MaintainPro';
    const body  = data.body  || 'You have a new notification.';
    const jobId = data.jobId || '';

    if (!toUid) {
      console.warn('No toUid — skipping.');
      return null;
    }

    // ── Get FCM tokens for the target user ───────
    let tokens = [];
    try {
      const userDoc = await admin.firestore().collection('users').doc(toUid).get();
      if (!userDoc.exists) {
        console.warn('User not found:', toUid);
        return null;
      }
      tokens = userDoc.data().fcmTokens || [];
    } catch (e) {
      console.error('Failed to fetch tokens:', e.message);
      return null;
    }

    if (!tokens.length) {
      console.warn('No FCM tokens for user:', toUid);
      return snap.ref.update({ pushed: false, pushedAt: new Date().toISOString() });
    }

    // ── Send push to all devices ─────────────────
    const message = {
      notification: { title, body },
      data: {
        jobId: String(jobId),
        toUid: String(toUid),
      },
      webpush: {
        notification: {
          title,
          body,
          icon:  'https://borj19.github.io/MaintainProRayan/icon-192.png',
          badge: 'https://borj19.github.io/MaintainProRayan/icon-192.png',
          requireInteraction: true,
          actions: [
            { action: 'view',    title: '👁 View task' },
            { action: 'dismiss', title: 'Dismiss'      },
          ],
        },
        fcmOptions: {
          link: 'https://borj19.github.io/MaintainProRayan/',
        },
      },
      tokens,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`✅ Sent to ${response.successCount}/${tokens.length} devices`);

      // Remove invalid tokens
      const badTokens = [];
      response.responses.forEach((res, i) => {
        if (!res.success) {
          const code = res.error && res.error.code;
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            badTokens.push(tokens[i]);
          }
        }
      });

      if (badTokens.length) {
        const clean = tokens.filter(t => !badTokens.includes(t));
        await admin.firestore().collection('users').doc(toUid).update({ fcmTokens: clean });
        console.log('🧹 Removed', badTokens.length, 'invalid token(s)');
      }

      return snap.ref.update({
        pushed:       true,
        pushedAt:     new Date().toISOString(),
        successCount: response.successCount,
        failureCount: response.failureCount,
      });

    } catch (e) {
      console.error('sendEachForMulticast failed:', e.message);
      return snap.ref.update({ pushed: false, error: e.message });
    }
  });

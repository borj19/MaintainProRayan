// ═══════════════════════════════════════════════
// functions/index.js — Firebase Cloud Functions
// MaintainPro — Push Notification Dispatcher
// ═══════════════════════════════════════════════

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp }     = require('firebase-admin/app');
const { getFirestore }      = require('firebase-admin/firestore');
const { getMessaging }      = require('firebase-admin/messaging');

initializeApp();

// ── Triggered when a new notification doc is created ──
// notifyUser() and notifyByUid() write to this collection
exports.sendPushNotification = onDocumentCreated(
  'notifications/{docId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data    = snap.data();
    const toUid   = data.toUid;
    const title   = data.title   || 'MaintainPro';
    const body    = data.body    || 'You have a new notification.';
    const jobId   = data.jobId   || '';

    if (!toUid) {
      console.warn('No toUid in notification doc — skipping.');
      return;
    }

    const db = getFirestore();

    // ── Get FCM tokens for the target user ───────
    let tokens = [];
    try {
      const userDoc = await db.collection('users').doc(toUid).get();
      if (!userDoc.exists) {
        console.warn(`User ${toUid} not found.`);
        return;
      }
      tokens = userDoc.data().fcmTokens || [];
    } catch (e) {
      console.error('Failed to fetch user tokens:', e.message);
      return;
    }

    if (!tokens.length) {
      console.warn(`No FCM tokens for user ${toUid} — they may not have logged in yet.`);
      // Mark notification as sent anyway so it shows in-app
      await snap.ref.update({ pushed: false, pushedAt: new Date().toISOString() });
      return;
    }

    // ── Send push to all devices for this user ───
    const messaging = getMessaging();
    const message = {
      notification: { title, body },
      data: {
        jobId:   String(jobId),
        toUid:   String(toUid),
        click_action: 'FLUTTER_NOTIFICATION_CLICK', // ensures tap opens app
      },
      webpush: {
        notification: {
          title,
          body,
          icon:  '/icon-192.png',
          badge: '/icon-192.png',
          requireInteraction: true,
          actions: [
            { action: 'view',    title: '👁 View task' },
            { action: 'dismiss', title: 'Dismiss'     },
          ],
        },
        fcmOptions: {
          link: 'https://borj19.github.io/MaintainProRayan/',
        },
      },
      tokens, // send to all devices this user has logged in from
    };

    try {
      const response = await messaging.sendEachForMulticast(message);
      console.log(`✅ Push sent to ${response.successCount}/${tokens.length} devices for user ${toUid}`);

      // ── Clean up invalid/expired tokens ─────────
      const invalidTokens = [];
      response.responses.forEach((res, i) => {
        if (!res.success) {
          const code = res.error?.code;
          console.warn(`Token ${i} failed:`, code);
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[i]);
          }
        }
      });

      // Remove bad tokens from Firestore
      if (invalidTokens.length) {
        const userRef = db.collection('users').doc(toUid);
        const cleanedTokens = tokens.filter(t => !invalidTokens.includes(t));
        await userRef.update({ fcmTokens: cleanedTokens });
        console.log(`🧹 Removed ${invalidTokens.length} invalid token(s)`);
      }

      // Mark notification doc as pushed
      await snap.ref.update({
        pushed:        true,
        pushedAt:      new Date().toISOString(),
        successCount:  response.successCount,
        failureCount:  response.failureCount,
      });

    } catch (e) {
      console.error('sendEachForMulticast failed:', e.message);
      await snap.ref.update({ pushed: false, error: e.message });
    }
  }
);


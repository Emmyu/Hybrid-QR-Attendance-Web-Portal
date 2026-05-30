const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

/**
 * Validates and records student attendance.
 * 
 * Implements PRD §3.5:
 * 1. QR Expiry check (15-minute window)
 * 2. Device-level validation (prevent multiple students per phone)
 * 3. Student duplicate check (one record per student per session)
 * 
 * @param {Object} data - { sessionId, qrTimestamp, deviceId, studentId, studentName }
 * @param {Object} context - Auth context
 */
exports.submitAttendance = functions.https.onCall(async (data, context) => {
  // 1. Authentication Check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
  }

  const { sessionId, qrTimestamp, deviceId, studentId, studentName } = data;
  const uid = context.auth.uid;

  if (!sessionId || !deviceId || !studentId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
  }

  try {
    // 2. Fetch Session Data
    const sessionRef = db.collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Session does not exist.');
    }

    const session = sessionDoc.data();
    
    // 3. Status Check
    if (session.status !== 'active') {
      throw new functions.https.HttpsError('failed-precondition', 'This session is no longer active.');
    }

    // 4. QR Expiry Validation (PRD §3.5.1)
    if (qrTimestamp) {
      const qrExpiryMinutes = session.qrExpiry || 15;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const elapsedSeconds = nowSeconds - qrTimestamp;
      const expirySeconds = qrExpiryMinutes * 60;

      // Allow 60s clock skew tolerance
      if (elapsedSeconds > expirySeconds) {
        throw new functions.https.HttpsError('deadline-exceeded', 'The scanned QR code has expired.');
      }
      if (elapsedSeconds < -60) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid QR code timestamp.');
      }
    }

    // 5. Transaction for Atomic Validation & Update
    await db.runTransaction(async (transaction) => {
      // 5a. Student Duplicate Check
      const recordId = `${sessionId}_${uid}`;
      const recordRef = db.collection('attendance').doc(recordId);
      const recordDoc = await transaction.get(recordRef);

      if (recordDoc.exists) {
        throw new functions.https.HttpsError('already-exists', 'You have already marked attendance for this session.');
      }

      // 5b. Device Binding Validation (PRD §3.5.2)
      // Check if this device has already been used in this session by ANY student
      const deviceQuery = db.collection('attendance')
        .where('sessionId', '==', sessionId)
        .where('deviceId', '==', deviceId)
        .limit(1);
      
      const deviceSnap = await transaction.get(deviceQuery);
      if (!deviceSnap.empty) {
        const otherStudent = deviceSnap.docs[0].data().studentName || 'another student';
        throw new functions.https.HttpsError('failed-precondition', 
          `This device has already been used by ${otherStudent}. Only one student per device is allowed.`);
      }

      // 6. Record Attendance
      transaction.set(recordRef, {
        sessionId,
        lecturerId: session.lecturerId,
        studentUid: uid,
        studentId,
        studentName,
        matricNo: studentId,
        deviceId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        method: 'qr_scan'
      });

      // 7. Increment Session Count
      transaction.update(sessionRef, {
        presentCount: admin.firestore.FieldValue.increment(1)
      });
    });

    return { success: true, message: 'Attendance recorded successfully.' };

  } catch (error) {
    console.error('Attendance Submission Error:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'An unexpected error occurred.');
  }
});

// s24_emerg_conn.js
// Usage:
//   frida -U -n com.sec.imsservice -l s24_emerg_conn.js
//
// Then in the Frida REPL:
//   enable()
//   disable()

var TAG = "s24-emerg-conn";
var PDN_TYPE = 15; // emergency
var PHONE_ID = 0;

// ─── Shared state (enable → disable) ────────────────────────────────────────

var gPdnInstance  = null;
var gPdnListener  = null;
var gPdnClassName = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

function logInfo(message) {
    Java.perform(function() {
        Java.use("android.util.Log").i(TAG, message);
    });
}

function getTimestamp() {
    var now = new Date();
    return [
        String(now.getMonth() + 1).padStart(2, '0'),
        "-",
        String(now.getDate()).padStart(2, '0'),
        " ",
        String(now.getHours()).padStart(2, '0'),
        ":",
        String(now.getMinutes()).padStart(2, '0'),
        ":",
        String(now.getSeconds()).padStart(2, '0'),
        ".",
        String(now.getMilliseconds()).padStart(3, '0')
    ].join('');
}

function getField(obj, fieldName) {
    var cls = obj.getClass();
    while (cls != null) {
        try {
            var f = cls.getDeclaredField(fieldName);
            f.setAccessible(true);
            return f.get(obj);
        } catch(e) {
            cls = cls.getSuperclass();
        }
    }
    return null;
}

// ─── enable ─────────────────────────────────────────────────────────────────

function enableEmergencyPdn() {
    Java.scheduleOnMainThread(function() {
        console.log(getTimestamp() + " [s24-emerg-conn] ===== enableEmergencyPdn() START =====");
        logInfo("enableEmergencyPdn() called");

        Java.choose("com.sec.internal.ims.core.RegistrationManagerBase", {
            onMatch: function(rmBase) {
                try {
                    console.log(getTimestamp() + " [s24-emerg-conn] Found: " + rmBase.getClass().getName());

                    // ── Get emergencyProfile ──
                    var imsProfile = rmBase.getEmergencyProfile(PHONE_ID);
                    if (imsProfile == null) {
                        console.log(getTimestamp() + " [s24-emerg-conn] emergencyProfile is null — aborting");
                        logInfo("emergencyProfile is null, abort");
                        return;
                    }
                    console.log(getTimestamp() + " [s24-emerg-conn] emergencyProfile: " + imsProfile.toString());

                    // ── Extract fields from RegistrationManagerBase ──
                    var mTelephonyManager = getField(rmBase, "mTelephonyManager");
                    var mPdnController    = getField(rmBase, "mPdnController");
                    var mContext          = getField(rmBase, "mContext");
                    var mVsm              = getField(rmBase, "mVsm");
                    var mConfigModule     = getField(rmBase, "mConfigModule");

                    gPdnClassName = mPdnController.getClass().getName();
                    console.log(getTimestamp() + " [s24-emerg-conn] PdnController class: " + gPdnClassName);

                    // ── Build RegisterTask ──
                    var RegisterTask = Java.use("com.sec.internal.ims.core.RegisterTask");
                    var registerTask = RegisterTask.$new(
                        imsProfile,
                        rmBase,
                        mTelephonyManager,
                        mPdnController,
                        mContext,
                        mVsm,
                        mConfigModule,
                        PHONE_ID
                    );
                    console.log(getTimestamp() + " [s24-emerg-conn] RegisterTask created: " + registerTask);

                    // ── Wire up callback Message ──
                    var HandlerThread = Java.use("android.os.HandlerThread");
                    var Handler       = Java.use("android.os.Handler");
                    var Message       = Java.use("android.os.Message");
                    var ht = HandlerThread.$new("frida-s24-enable-cb");
                    ht.start();
                    var handler = Handler.$new(ht.getLooper());
                    var msg = Message.obtain(handler);
                    registerTask.setResultMessage(msg);

                    // ── Set pdnType + state ──
                    registerTask.setPdnType(PDN_TYPE);

                    var RegisterTaskState = Java.use(
                        "com.sec.internal.constants.ims.core.RegistrationConstants$RegisterTaskState"
                    );
                    registerTask.setState(RegisterTaskState.CONNECTING.value);

                    // ── Cast to PdnEventListener + save globally ──
                    var PdnEventListener = Java.use(
                        "com.sec.internal.interfaces.ims.core.PdnEventListener"
                    );
                    gPdnListener = Java.cast(registerTask, PdnEventListener);

                    // ── Cast PdnController + save globally ──
                    var PdnControllerClass = Java.use(gPdnClassName);
                    gPdnInstance = Java.cast(mPdnController, PdnControllerClass);

                    // ── Call startPdnConnectivity ──
                    console.log(getTimestamp() + " [s24-emerg-conn] Calling startPdnConnectivity(pdnType="
                        + PDN_TYPE + ", pdnListener, phoneId=" + PHONE_ID + ") ...");
                    logInfo("calling startPdnConnectivity pdnType=" + PDN_TYPE + " phoneId=" + PHONE_ID);

                    gPdnInstance.startPdnConnectivity.overload(
                        'int',
                        'com.sec.internal.interfaces.ims.core.PdnEventListener',
                        'int'
                    ).call(gPdnInstance, PDN_TYPE, gPdnListener, PHONE_ID);

                    console.log(getTimestamp() + " [s24-emerg-conn] startPdnConnectivity called → Emergency PDN requested ✓");
                    console.log(getTimestamp() + " [s24-emerg-conn] pdnListener saved — ready for disable()");
                    logInfo("startPdnConnectivity called successfully, listener saved");

                } catch(e) {
                    console.log(getTimestamp() + " [s24-emerg-conn] Error: " + e.message);
                    console.log(getTimestamp() + " [s24-emerg-conn] Stack: " + e.stack);
                    logInfo("enableEmergencyPdn error: " + e.message);
                }
            },
            onComplete: function() {
                console.log(getTimestamp() + " [s24-emerg-conn] ===== enableEmergencyPdn() END =====");
                logInfo("enableEmergencyPdn() END");
            }
        });
    });
}

// ─── disable ────────────────────────────────────────────────────────────────

function disableEmergencyPdn() {
    Java.scheduleOnMainThread(function() {
        console.log(getTimestamp() + " [s24-emerg-conn] ===== disableEmergencyPdn() START =====");
        logInfo("disableEmergencyPdn() called");

        // ── Guard: must have called enable() first ──
        if (gPdnInstance == null || gPdnListener == null) {
            console.log(getTimestamp() + " [s24-emerg-conn] ERROR: no active session — call enable() first");
            logInfo("disableEmergencyPdn: gPdnInstance or gPdnListener is null, abort");
            return;
        }

        try {
            console.log(getTimestamp() + " [s24-emerg-conn] Calling stopPdnConnectivity(pdnType="
                + PDN_TYPE + ", savedPdnListener) ...");
            logInfo("calling stopPdnConnectivity pdnType=" + PDN_TYPE);

            var result = gPdnInstance.stopPdnConnectivity.overload(
                'int',
                'com.sec.internal.interfaces.ims.core.PdnEventListener'
            ).call(gPdnInstance, PDN_TYPE, gPdnListener);

            console.log(getTimestamp() + " [s24-emerg-conn] stopPdnConnectivity returned: " + result
                + (result === 0 ? " → Emergency PDN teardown requested ✓"
                                : " → non-zero return, check PdnController logs"));
            logInfo("stopPdnConnectivity returned=" + result);

            // ── Clear saved state ──
            if (result === 0) {
                gPdnListener = null;
                console.log(getTimestamp() + " [s24-emerg-conn] Saved listener cleared");
            }

        } catch(e) {
            console.log(getTimestamp() + " [s24-emerg-conn] Error: " + e.message);
            console.log(getTimestamp() + " [s24-emerg-conn] Stack: " + e.stack);
            logInfo("disableEmergencyPdn error: " + e.message);
        }

        console.log(getTimestamp() + " [s24-emerg-conn] ===== disableEmergencyPdn() END =====");
        logInfo("disableEmergencyPdn() END");
    });
}

// ─── Expose to REPL ─────────────────────────────────────────────────────────

globalThis.enable  = enableEmergencyPdn;
globalThis.disable = disableEmergencyPdn;

rpc.exports = {
    enable:  enableEmergencyPdn,
    disable: disableEmergencyPdn
};

// ─── Ready banner ────────────────────────────────────────────────────────────

console.log(getTimestamp() + " [s24-emerg-conn] s24_emerg_conn.js loaded — pdnType=" + PDN_TYPE + " phoneId=" + PHONE_ID);
console.log(getTimestamp() + " [s24-emerg-conn]   enable()   → startPdnConnectivity(pdnType=15, listener, phoneId=0)");
console.log(getTimestamp() + " [s24-emerg-conn]   disable()  → stopPdnConnectivity(pdnType=15, savedListener)");


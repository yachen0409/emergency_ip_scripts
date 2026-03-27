// pixel_emerg_conn.js
// Usage:
//   frida -U -n com.shannon.imsservice -l pixel_emerg_conn.js
//
// Then in the Frida REPL:
//   enable
//   disable

var TAG = "pixel-emerg-conn";
var SLOT_ID = 0;

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

// ─── enable ─────────────────────────────────────────────────────────────────

function triggerEmergencyPdn() {
    Java.perform(function() {
        console.log(getTimestamp() + " [pixel-emerg-conn] ===== triggerEmergencyPdn() START =====");
        logInfo("triggerEmergencyPdn() called for slotId=" + SLOT_ID);

        var ApnNetType = Java.use("com.shannon.imsservice.conn.ApnNetType");
        var cellConnFound = null;

        Java.choose("com.shannon.imsservice.conn.rule.ConnectivityRuleMgr", {
            onMatch: function(ruleMgr) {
                try {
                    var rid = ruleMgr.mSlotId ? ruleMgr.mSlotId.value : -1;
                    if (rid !== SLOT_ID) return;
                    cellConnFound = ruleMgr.getCellConnectivity();
                    console.log(getTimestamp() + " [pixel-emerg-conn] CellConnectivity: " + cellConnFound);
                    logInfo("CellConnectivity found: " + cellConnFound);
                } catch(e) {
                    console.log(getTimestamp() + " [pixel-emerg-conn] Error reading ConnectivityRuleMgr: " + e);
                }
            },
            onComplete: function() {
                if (!cellConnFound) {
                    console.log(getTimestamp() + " [pixel-emerg-conn] ERROR: CellConnectivity not found — aborting");
                    return;
                }

                var apnManagerFound = false;
                Java.choose("com.shannon.imsservice.conn.ApnManager", {
                    onMatch: function(apnManager) {
                        try {
                            var amid = apnManager.mSlotId ? apnManager.mSlotId.value : -1;
                            if (amid !== SLOT_ID) return;
                            if (apnManagerFound) return;
                            apnManagerFound = true;

                            // Pre-flight state log
                            try {
                                var existingEntity = apnManager.mApns.value.get(ApnNetType.APN_EMERGENCY.value);
                                if (existingEntity !== null) {
                                    var castEntity = Java.cast(existingEntity,
                                        Java.use("com.shannon.imsservice.conn.ApnEntity"));
                                    console.log(getTimestamp() + " [pixel-emerg-conn] Existing APN_EMERGENCY state: "
                                        + castEntity.getServiceState()
                                        + " isNetworkCallback=" + castEntity.isNetworkCallback());
                                } else {
                                    console.log(getTimestamp() + " [pixel-emerg-conn] No existing APN_EMERGENCY entity");
                                }
                            } catch(e) {
                                console.log(getTimestamp() + " [pixel-emerg-conn] Could not read existing ApnEntity: " + e);
                            }

                            console.log(getTimestamp() + " [pixel-emerg-conn] Calling enableApn(APN_EMERGENCY) ...");
                            var result = apnManager.enableApn(
                                ApnNetType.APN_EMERGENCY.value,
                                cellConnFound,
                                null
                            );

                            if (result !== null) {
                                console.log(getTimestamp() + " [pixel-emerg-conn] enableApn OK → ApnEntity: " + result + " ✓");
                            } else {
                                console.log(getTimestamp() + " [pixel-emerg-conn] enableApn returned null (already active or guard hit)");
                            }

                        } catch(e) {
                            console.log(getTimestamp() + " [pixel-emerg-conn] Error in enableApn: " + e);
                            console.log(getTimestamp() + " [pixel-emerg-conn] Stack: " + e.stack);
                        }
                    },
                    onComplete: function() {
                        if (!apnManagerFound) {
                            console.log(getTimestamp() + " [pixel-emerg-conn] ERROR: ApnManager not found for slotId=" + SLOT_ID);
                        }
                        console.log(getTimestamp() + " [pixel-emerg-conn] ===== triggerEmergencyPdn() END =====");
                    }
                });
            }
        });
    });
}

// ─── disable ────────────────────────────────────────────────────────────────

function disableEmergencyPdn() {
    Java.perform(function() {
        console.log(getTimestamp() + " [pixel-emerg-conn] ===== disableEmergencyPdn() START =====");
        logInfo("disableEmergencyPdn() called for slotId=" + SLOT_ID);

        var ApnNetType = Java.use("com.shannon.imsservice.conn.ApnNetType");

        Java.choose("com.shannon.imsservice.conn.ApnManager", {
            onMatch: function(apnManager) {
                try {
                    var amid = apnManager.mSlotId ? apnManager.mSlotId.value : -1;
                    if (amid !== SLOT_ID) return;

                    // Pre-flight state log
                    try {
                        var existingEntity = apnManager.mApns.value.get(ApnNetType.APN_EMERGENCY.value);
                        if (existingEntity !== null) {
                            var castEntity = Java.cast(existingEntity,
                                Java.use("com.shannon.imsservice.conn.ApnEntity"));
                            console.log(getTimestamp() + " [pixel-emerg-conn] Current APN_EMERGENCY state before disable: "
                                + castEntity.getServiceState()
                                + " isNetworkCallback=" + castEntity.isNetworkCallback());
                        } else {
                            console.log(getTimestamp() + " [pixel-emerg-conn] No existing APN_EMERGENCY entity — may already be disabled");
                        }
                    } catch(e) {
                        console.log(getTimestamp() + " [pixel-emerg-conn] Could not read existing ApnEntity: " + e);
                    }

                    console.log(getTimestamp() + " [pixel-emerg-conn] Calling disableApn(APN_EMERGENCY) ...");
                    var result = apnManager.disableApn(ApnNetType.APN_EMERGENCY.value);

                    console.log(getTimestamp() + " [pixel-emerg-conn] disableApn returned: " + result
                        + (result ? " → Emergency PDN teardown requested ✓"
                                  : " → teardown failed or PDN already inactive"));

                } catch(e) {
                    console.log(getTimestamp() + " [pixel-emerg-conn] Error in disableApn: " + e);
                    console.log(getTimestamp() + " [pixel-emerg-conn] Stack: " + e.stack);
                }
            },
            onComplete: function() {
                console.log(getTimestamp() + " [pixel-emerg-conn] ===== disableEmergencyPdn() END =====");
            }
        });
    });
}

// ─── Expose to REPL as bare words ───────────────────────────────────────────

globalThis.enable  = triggerEmergencyPdn;
globalThis.disable = disableEmergencyPdn;

rpc.exports = {
    enable:  triggerEmergencyPdn,
    disable: disableEmergencyPdn
};

// ─── Ready banner ────────────────────────────────────────────────────────────

console.log(getTimestamp() + " [pixel-emerg-conn] pixel_emerg_conn.js loaded — slotId=" + SLOT_ID);
console.log(getTimestamp() + " [pixel-emerg-conn]   enable()   → enableApn(APN_EMERGENCY)");
console.log(getTimestamp() + " [pixel-emerg-conn]   disable()  → disableApn(APN_EMERGENCY)");


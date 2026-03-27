Java.perform(function() {
    var Log = Java.use("android.util.Log");
    var TAG = "frida-emergency-disable";

    function logInfo(message) {
        Log.i(TAG, message);
    }

    function getTimestamp() {
        var now = new Date();
        var month = String(now.getMonth() + 1).padStart(2, '0');
        var day = String(now.getDate()).padStart(2, '0');
        var hours = String(now.getHours()).padStart(2, '0');
        var minutes = String(now.getMinutes()).padStart(2, '0');
        var seconds = String(now.getSeconds()).padStart(2, '0');
        var milliseconds = String(now.getMilliseconds()).padStart(3, '0');
        return month + "-" + day + " " + hours + ":" + minutes + ":" + seconds + "." + milliseconds;
    }

    function disableEmergencyPdn(slotId) {
        var ts = getTimestamp();
        logInfo("disableEmergencyPdn() called for slotId=" + slotId);
        console.log(ts + " [EMC] ===== disableEmergencyPdn() START =====");

        var ApnNetType = Java.use("com.shannon.imsservice.conn.ApnNetType");

        Java.choose("com.shannon.imsservice.conn.ApnManager", {
            onMatch: function(apnManager) {
                try {
                    var amid = apnManager.mSlotId ? apnManager.mSlotId.value : -1;
                    if (amid !== slotId) return;

                    // Pre-flight: log current APN_EMERGENCY state before disabling
                    try {
                        var existingEntity = apnManager.mApns.value.get(ApnNetType.APN_EMERGENCY.value);
                        if (existingEntity !== null) {
                            var castEntity = Java.cast(existingEntity,
                                Java.use("com.shannon.imsservice.conn.ApnEntity"));
                            console.log(getTimestamp() + " [EMC] Current APN_EMERGENCY state before disable: "
                                + castEntity.getServiceState()
                                + " isNetworkCallback=" + castEntity.isNetworkCallback());
                            logInfo("disableEmergencyPdn: current APN_EMERGENCY state="
                                + castEntity.getServiceState());
                        } else {
                            console.log(getTimestamp() + " [EMC] No existing APN_EMERGENCY entity — may already be disabled");
                            logInfo("disableEmergencyPdn: no existing APN_EMERGENCY entity");
                        }
                    } catch(e) {
                        console.log(getTimestamp() + " [EMC] Could not read existing ApnEntity: " + e);
                    }

                    console.log(getTimestamp() + " [EMC] Calling disableApn(APN_EMERGENCY) ...");
                    logInfo("disableEmergencyPdn: calling disableApn(APN_EMERGENCY)");

                    // disableApn(ApnNetType apnNetType) — single-arg overload
                    // internally calls disableApn(apnNetType, getCurrentRat(apnNetType))
                    var result = apnManager.disableApn(ApnNetType.APN_EMERGENCY.value);

                    console.log(getTimestamp() + " [EMC] disableApn returned: " + result
                        + (result ? " → Emergency PDN teardown requested ✓" : " → teardown may have failed or PDN already inactive"));
                    logInfo("disableEmergencyPdn: disableApn returned=" + result);

                } catch(e) {
                    console.log(getTimestamp() + " [EMC] Error in disableApn call: " + e);
                    console.log(getTimestamp() + " [EMC] Stack: " + e.stack);
                    logInfo("disableEmergencyPdn: disableApn error: " + e);
                }
            },
            onComplete: function() {
                console.log(getTimestamp() + " [EMC] ===== disableEmergencyPdn() END =====");
                logInfo("disableEmergencyPdn() END");
            }
        });
    }

    setTimeout(function() {
        try {
            disableEmergencyPdn(0);
        } catch(e) {
            console.log(getTimestamp() + " [EMC] Uncaught error in disableEmergencyPdn: " + e);
            logInfo("disableEmergencyPdn uncaught: " + e);
        }
    }, 3000);

});


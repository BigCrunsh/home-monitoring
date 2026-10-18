const LOCK_STATE_ID = 'hm-rpc.1.002A226996B89C.1.LOCK_STATE';
const LOCK_TARGET_ID = 'hm-rpc.1.002A226996B89C.1.LOCK_TARGET_LEVEL';
const OPEN_RESET_DELAY_MS = 7000;

let openResetTimer = null;

on({ id: LOCK_STATE_ID, change: 'any' }, (obj) => {
  // Never let a reset scheduled for an earlier event survive: it could unlock a door that was locked since.
  if (openResetTimer) {
    clearTimeout(openResetTimer);
    openResetTimer = null;
  }

  const lockState = obj.state.val;
  const target = getState(LOCK_TARGET_ID).val;

  if (lockState == 1 && target == 'UNLOCKED') {
    setState(LOCK_TARGET_ID, 'LOCKED');
  }
  if (lockState == 2 && target == 'LOCKED') {
    setState(LOCK_TARGET_ID, 'UNLOCKED');
  }
  if (lockState == 2 && target == 'OPEN') {
    openResetTimer = setTimeout(() => {
      openResetTimer = null;
      if (getState(LOCK_STATE_ID).val == 2 && getState(LOCK_TARGET_ID).val == 'OPEN') {
        setState(LOCK_TARGET_ID, 'UNLOCKED');
      }
    }, OPEN_RESET_DELAY_MS);
  }
});

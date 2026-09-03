"""Pure monitor state machine.

Given the monitor's current status, its consecutive failure/success counters,
the outcome of a new check, and the configured thresholds, compute the next
status and whether an incident should be opened or resolved. Kept free of any
I/O so it can be unit-tested exhaustively (see tests/test_thresholds.py).

Transitions (see spec section 9):
    UNKNOWN --(any success)--> UP
    UNKNOWN/UP --(failure_threshold consecutive failures)--> DOWN, opens incident
    DOWN --(recovery_threshold consecutive successes)--> UP, resolves incident
PAUSED is handled entirely by MonitorService (this module is never invoked for
a paused monitor, since paused monitors have no scheduled job).
"""

from dataclasses import dataclass

from app.models.enums import MonitorStatus


@dataclass(frozen=True)
class StateTransition:
    new_status: MonitorStatus
    consecutive_failures: int
    consecutive_successes: int
    should_open_incident: bool
    should_resolve_incident: bool


def apply_check_result(
    *,
    current_status: MonitorStatus,
    is_success: bool,
    consecutive_failures: int,
    consecutive_successes: int,
    failure_threshold: int,
    recovery_threshold: int,
) -> StateTransition:
    failure_threshold = max(1, failure_threshold)
    recovery_threshold = max(1, recovery_threshold)

    if is_success:
        consecutive_successes += 1
        consecutive_failures = 0
    else:
        consecutive_failures += 1
        consecutive_successes = 0

    new_status = current_status
    should_open_incident = False
    should_resolve_incident = False

    if is_success:
        if current_status == MonitorStatus.DOWN:
            if consecutive_successes >= recovery_threshold:
                new_status = MonitorStatus.UP
                should_resolve_incident = True
        else:
            new_status = MonitorStatus.UP
    else:
        if current_status in (MonitorStatus.UP, MonitorStatus.UNKNOWN):
            if consecutive_failures >= failure_threshold:
                new_status = MonitorStatus.DOWN
                should_open_incident = True
        elif current_status == MonitorStatus.DOWN:
            new_status = MonitorStatus.DOWN

    return StateTransition(
        new_status=new_status,
        consecutive_failures=consecutive_failures,
        consecutive_successes=consecutive_successes,
        should_open_incident=should_open_incident,
        should_resolve_incident=should_resolve_incident,
    )

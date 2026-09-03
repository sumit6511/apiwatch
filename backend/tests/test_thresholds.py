from app.models.enums import MonitorStatus
from app.monitoring.state import apply_check_result


def _fail(status, cf, cs, failure_threshold=1, recovery_threshold=1):
    return apply_check_result(
        current_status=status,
        is_success=False,
        consecutive_failures=cf,
        consecutive_successes=cs,
        failure_threshold=failure_threshold,
        recovery_threshold=recovery_threshold,
    )


def _succeed(status, cf, cs, failure_threshold=1, recovery_threshold=1):
    return apply_check_result(
        current_status=status,
        is_success=True,
        consecutive_failures=cf,
        consecutive_successes=cs,
        failure_threshold=failure_threshold,
        recovery_threshold=recovery_threshold,
    )


def test_unknown_to_up_on_first_success():
    t = _succeed(MonitorStatus.UNKNOWN, 0, 0)
    assert t.new_status == MonitorStatus.UP
    assert not t.should_open_incident
    assert not t.should_resolve_incident


def test_default_threshold_one_failure_goes_down_immediately():
    t = _fail(MonitorStatus.UP, 0, 0, failure_threshold=1)
    assert t.new_status == MonitorStatus.DOWN
    assert t.should_open_incident


def test_failure_threshold_three_stays_up_until_third_failure():
    t1 = _fail(MonitorStatus.UP, 0, 0, failure_threshold=3)
    assert t1.new_status == MonitorStatus.UP
    assert not t1.should_open_incident
    assert t1.consecutive_failures == 1

    t2 = _fail(MonitorStatus.UP, t1.consecutive_failures, t1.consecutive_successes, failure_threshold=3)
    assert t2.new_status == MonitorStatus.UP
    assert not t2.should_open_incident
    assert t2.consecutive_failures == 2

    t3 = _fail(MonitorStatus.UP, t2.consecutive_failures, t2.consecutive_successes, failure_threshold=3)
    assert t3.new_status == MonitorStatus.DOWN
    assert t3.should_open_incident
    assert t3.consecutive_failures == 3


def test_down_does_not_open_a_second_incident_on_repeated_failure():
    t = _fail(MonitorStatus.DOWN, 3, 0, failure_threshold=3)
    assert t.new_status == MonitorStatus.DOWN
    assert not t.should_open_incident


def test_recovery_threshold_two_stays_down_until_second_success():
    t1 = _succeed(MonitorStatus.DOWN, 0, 0, recovery_threshold=2)
    assert t1.new_status == MonitorStatus.DOWN
    assert not t1.should_resolve_incident
    assert t1.consecutive_successes == 1

    t2 = _succeed(MonitorStatus.DOWN, t1.consecutive_failures, t1.consecutive_successes, recovery_threshold=2)
    assert t2.new_status == MonitorStatus.UP
    assert t2.should_resolve_incident
    assert t2.consecutive_successes == 2


def test_transient_failure_resets_recovery_streak():
    t1 = _succeed(MonitorStatus.DOWN, 0, 0, recovery_threshold=2)
    assert t1.consecutive_successes == 1

    t2 = _fail(MonitorStatus.DOWN, t1.consecutive_failures, t1.consecutive_successes, recovery_threshold=2)
    assert t2.consecutive_successes == 0
    assert t2.new_status == MonitorStatus.DOWN

    t3 = _succeed(MonitorStatus.DOWN, t2.consecutive_failures, t2.consecutive_successes, recovery_threshold=2)
    assert t3.new_status == MonitorStatus.DOWN
    assert t3.consecutive_successes == 1


def test_consecutive_counters_reset_on_opposite_outcome():
    t = _succeed(MonitorStatus.UP, 5, 0)
    assert t.consecutive_failures == 0
    assert t.consecutive_successes == 1

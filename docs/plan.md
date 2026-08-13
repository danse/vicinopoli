# Plan

Roadmap and milestones for **vicinopoli**.

## Vision

A localized social network with an extremely low entry threshold: open the PWA,
enter an address, optionally choose a pseudonym, and immediately post text,
voice, or photos to your neighbours. No account, no password.

Initial target: Italy. Internationalisation (i18n) in place from day one
(`it` default, `en` parallel).

## Key semantics

### Visibility (asymmetric ranges)

- A post carries `scope` = author's max reach (`building`, `500m`, `1km`, `5km`).
- A viewer carries `search_radius`.
- Visibility = `distance <= scope` AND `distance <= search_radius`;
  `building` requires a matching normalized address key.

### Cold bootstrap

- Feed auto-expands radius until ~10 posts (ceiling ~50km).

### Trust ladder

- New devices can post immediately but with reduced reach until they accrue
  trust (age, no reports, engagement).
- Phone verification is a later, optional *reach* gate — never a read gate.

## To do

github integration failed with the following backend error:

==================================== ERRORS ====================================
_______ ERROR at setup of test_device_exposes_segment_flags_and_consent ________

request = <SubRequest 'engine' for <Coroutine test_device_exposes_segment_flags_and_consent>>
kwargs = {}, func = <function engine at 0x7fecbe6463e0>
event_loop_fixture_id = '_session_event_loop'
setup = <function _wrap_asyncgen_fixture.<locals>._asyncgen_fixture_wrapper.<locals>.setup at 0x7fecbddfa0c0>
setup_task = <Task finished name='Task-1' coro=<_wrap_asyncgen_fixture.<locals>._asyncgen_fixture_wrapper.<locals>.setup() done, de...exceptions: [Errno 111] Connect call failed ('::1', 5433, 0, 0), [Errno 111] Connect call failed ('127.0.0.1', 5433)")>

    @functools.wraps(fixture)
    def _asyncgen_fixture_wrapper(request: FixtureRequest, **kwargs: Any):
        func = _perhaps_rebind_fixture_func(fixture, request.instance)
        event_loop_fixture_id = _get_event_loop_fixture_id_for_async_fixture(
            request, func
        )
        event_loop = request.getfixturevalue(event_loop_fixture_id)
        kwargs.pop(event_loop_fixture_id, None)
        gen_obj = func(**_add_kwargs(func, kwargs, event_loop, request))

github integration failed with the following e2e error:

[WebServer]  Container vicinopoli-caddy-1  Started

Error: Process from config.webServer exited early.
Error: Error: Process from config.webServer exited early.


make: *** [Makefile:42: test-e2e] Error 1
Error: Process completed with exit code 2.


- set vicinopoli.it in configs now that it's registered, page returns "secure connection failed" at the moment
- range-adjusting controls
- npm audit
- search engine optimisation
- connect the backend to sentry or to other notification service based on its logs (is that prometheus?)
- blind accessibility test for audio content workflows

Remove from the list when done

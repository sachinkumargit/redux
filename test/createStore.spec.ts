import { createStore, combineReducers, StoreEnhancer, Action, Store } from '..'
import {
  addTodo,
  dispatchInMiddle,
  getStateInMiddle,
  subscribeInMiddle,
  unsubscribeInMiddle,
  throwError,
  unknownAction
} from './helpers/actionCreators'
import * as reducers from './helpers/reducers'
import { from, ObservableInput } from 'rxjs'
import { map } from 'rxjs/operators'
import $$observable from '../src/utils/symbol-observable'

describe('createStore', () => {
  it('exposes the public API', () => {
    const store = createStore(combineReducers(reducers))

    // Since switching to internal Symbol.observable impl, it will show up as a key in node env
    // So we filter it out
    const methods = Object.keys(store).filter(key => key !== $$observable)

    expect(methods.length).toBe(4)
    expect(methods).toContain('subscribe')
    expect(methods).toContain('dispatch')
    expect(methods).toContain('getState')
    expect(methods).toContain('replaceReducer')
  })

  it('throws if reducer is not a function', () => {
    // @ts-expect-error
    expect(() => createStore(undefined)).toThrow()
    // @ts-expect-error
    expect(() => createStore('test')).toThrow()
    // @ts-expect-error
    expect(() => createStore({})).toThrow()

    expect(() => createStore(() => {})).not.toThrow()
  })

  it('passes the initial state', () => {
    const store = createStore(reducers.todos, [
      {
        id: 1,
        text: 'Hello'
      }
    ])
    expect(store.getState()).toEqual([
      {
        id: 1,
        text: 'Hello'
      }
    ])
  })

  it('applies the reducer to the previous state', () => {
    const store = createStore(reducers.todos)
    expect(store.getState()).toEqual([])

    store.dispatch(unknownAction())
    expect(store.getState()).toEqual([])

    store.dispatch(addTodo('Hello'))
    expect(store.getState()).toEqual([
      {
        id: 1,
        text: 'Hello'
      }
    ])

    store.dispatch(addTodo('World'))
    expect(store.getState()).toNotEqual([
      {
        id: 1,
        text: 'Hello'
      },
      {
        id: 2,
        text: 'World'
      }
    ])
  })

  it('applies the reducer to the initial state', () => {
    const store = createStore(reducers.todos, [
      {
        id: 1,
        text: 'Hello'
      }
    ])
    expect(store.getState()).toEqual([
      {
        id: 1,
        text: 'Hello'
      }
    ])

    store.dispatch(unknownAction())
    expect(store.getState()).toEqual([
      {
        id: 1,
        text: 'Hello'
      }
    ])

    store.dispatch(addTodo('World'))
    expect(store.getState()).toEqual([
      {
        id: 1,
        text: 'Hello'
      },
      {
        id: 2,
        text: 'World'
      }
    ])
  })

  it('preserves the state when replacing a reducer', () => {
    const store = createStore(reducers.todos)
    store.dispatch(addTodo('Hello'))
    store.dispatch(addTodo('World'))
    expect(store.getState()).toEqual([
      {
        id: 1,
        text: 'Hello'
      },
      {
        id: 2,
        text: 'World'
      }
    ])

    store.replaceReducer(reducers.todosReverse)
    expect(store.getState()).toEqual([
      {
        id: 1,
        text: 'Hello'
      },
      {
        id: 2,
        text: 'World'
      }
    ])

    store.dispatch(addTodo('Perhaps'))
    expect(store.getState()).toEqual([
      {
        id: 3,
        text: 'Perhaps'
      },
      {
        id: 1,
        text: 'Hello'
      },
      {
        id: 2,
        text: 'World'
      }
    ])

    store.replaceReducer(reducers.todos)
    expect(store.getState()).toEqual([
      {
        id: 3,
        text: 'Perhaps'
      },
      {
        id: 1,
        text: 'Hello'
      },
      {
        id: 2,
        text: 'World'
      }
    ])

    store.dispatch(addTodo('Surely'))
    expect(store.getState()).toEqual([
      {
        id: 3,
        text: 'Perhaps'
      },
      {
        id: 1,
        text: 'Hello'
      },
      {
        id: 2,
        text: 'World'
      },
      {
        id: 4,
        text: 'Surely'
      }
    ])
  })

  it('supports multiple subscriptions', () => {
    const store = createStore(reducers.todos)
    const listenerA = jest.fn()
    const listenerB = jest.fn()

    let unsubscribeA = store.subscribe(listenerA)
    store.dispatch(unknownAction())
    expect(listenerA.mock.calls.length).toBe(1)
    expect(listenerB.mock.calls.length).toBe(0)

    store.dispatch(unknownAction())
    expect(listenerA.mock.calls.length).toBe(2)
    expect(listenerB.mock.calls.length).toBe(0)

    const unsubscribeB = store.subscribe(listenerB)
    expect(listenerA.mock.calls.length).toBe(2)
    expect(listenerB.mock.calls.length).toBe(0)

    store.dispatch(unknownAction())
    expect(listenerA.mock.calls.length).toBe(3)
    expect(listenerB.mock.calls.length).toBe(1)

    unsubscribeA()
    expect(listenerA.mock.calls.length).toBe(3)
    expect(listenerB.mock.calls.length).toBe(1)

    store.dispatch(unknownAction())
    expect(listenerA.mock.calls.length).toBe(3)
    expect(listenerB.mock.calls.length).toBe(2)

    unsubscribeB()
    expect(listenerA.mock.calls.length).toBe(3)
    expect(listenerB.mock.calls.length).toBe(2)

    store.dispatch(unknownAction())
    expect(listenerA.mock.calls.length).toBe(3)
    expect(listenerB.mock.calls.length).toBe(2)

    unsubscribeA = store.subscribe(listenerA)
    expect(listenerA.mock.calls.length).toBe(3)
    expect(listenerB.mock.calls.length).toBe(2)

    store.dispatch(unknownAction())
    expect(listenerA.mock.calls.length).toBe(4)
    expect(listenerB.mock.calls.length).toBe(2)
  })

  it('only removes listener once when unsubscribe is called', () => {
    const store = createStore(reducers.todos)
    const listenerA = jest.fn()
    const listenerB = jest.fn()

    const unsubscribeA = store.subscribe(listenerA)
    store.subscribe(listenerB)

    unsubscribeA()
    unsubscribeA()

    store.dispatch(unknownAction())
    expect(listenerA.mock.calls.length).toBe(0)
    expect(listenerB.mock.calls.length).toBe(1)
  })

  it('only removes relevant listener when unsubscribe is called', () => {
    const store = createStore(reducers.todos)
    const listener = jest.fn()

    store.subscribe(listener)
    const unsubscribeSecond = store.subscribe(listener)

    unsubscribeSecond()
    unsubscribeSecond()

    store.dispatch(unknownAction())
    expect(listener.mock.calls.length).toBe(1)
  })

  it('supports removing a subscription within a subscription', () => {
    const store = createStore(reducers.todos)
    const listenerA = jest.fn()
    const listenerB = jest.fn()
    const listenerC = jest.fn()

    store.subscribe(listenerA)
    const unSubB = store.subscribe(() => {
      listenerB()
      unSubB()
    })
    store.subscribe(listenerC)

    store.dispatch(unknownAction())
    store.dispatch(unknownAction())

    expect(listenerA.mock.calls.length).toBe(2)
    expect(listenerB.mock.calls.length).toBe(1)
    expect(listenerC.mock.calls.length).toBe(2)
  })

  it('notifies all subscribers about current dispatch regardless if any of them gets unsubscribed in the process', () => {
    const store = createStore(reducers.todos)

    const unsubscribeHandles: any[] = []
    const doUnsubscribeAll = () =>
      unsubscribeHandles.forEach(unsubscribe => unsubscribe())

    const listener1 = jest.fn()
    const listener2 = jest.fn()
    const listener3 = jest.fn()

    unsubscribeHandles.push(store.subscribe(() => listener1()))
    unsubscribeHandles.push(
      store.subscribe(() => {
        listener2()
        doUnsubscribeAll()
      })
    )
    unsubscribeHandles.push(store.subscribe(() => listener3()))

    store.dispatch(unknownAction())
    expect(listener1.mock.calls.length).toBe(1)
    expect(listener2.mock.calls.length).toBe(1)
    expect(listener3.mock.calls.length).toBe(1)

    store.dispatch(unknownAction())
    expect(listener1.mock.calls.length).toBe(1)
    expect(listener2.mock.calls.length).toBe(1)
    expect(listener3.mock.calls.length).toBe(1)
  })

  it('notifies only subscribers active at the moment of current dispatch', () => {
    const store = createStore(reducers.todos)

    const listener1 = jest.fn()
    const listener2 = jest.fn()
    const listener3 = jest.fn()

    let listener3Added = false
    const maybeAddThirdListener = () => {
      if (!listener3Added) {
        listener3Added = true
        store.subscribe(() => listener3())
      }
    }

    store.subscribe(() => listener1())
    store.subscribe(() => {
      listener2()
      maybeAddThirdListener()
    })

    store.dispatch(unknownAction())
    expect(listener1.mock.calls.length).toBe(1)
    expect(listener2.mock.calls.length).toBe(1)
    expect(listener3.mock.calls.length).toBe(0)

    store.dispatch(unknownAction())
    expect(listener1.mock.calls.length).toBe(2)
    expect(listener2.mock.calls.length).toBe(2)
    expect(listener3.mock.calls.length).toBe(1)
  })

  it('uses the last snapshot of subscribers during nested dispatch', () => {
    const store = createStore(reducers.todos)

    const listener1 = jest.fn()
    const listener2 = jest.fn()
    const listener3 = jest.fn()
    const listener4 = jest.fn()

    let unsubscribe4: any
    const unsubscribe1 = store.subscribe(() => {
      listener1()
      expect(listener1.mock.calls.length).toBe(1)
      expect(listener2.mock.calls.length).toBe(0)
      expect(listener3.mock.calls.length).toBe(0)
      expect(listener4.mock.calls.length).toBe(0)

      unsubscribe1()
      unsubscribe4 = store.subscribe(listener4)
      store.dispatch(unknownAction())

      expect(listener1.mock.calls.length).toBe(1)
      expect(listener2.mock.calls.length).toBe(1)
      expect(listener3.mock.calls.length).toBe(1)
      expect(listener4.mock.calls.length).toBe(1)
    })
    store.subscribe(listener2)
    store.subscribe(listener3)

    store.dispatch(unknownAction())
    expect(listener1.mock.calls.length).toBe(1)
    expect(listener2.mock.calls.length).toBe(2)
    expect(listener3.mock.calls.length).toBe(2)
    expect(listener4.mock.calls.length).toBe(1)

    unsubscribe4()
    store.dispatch(unknownAction())
    expect(listener1.mock.calls.length).toBe(1)
    expect(listener2.mock.calls.length).toBe(3)
    expect(listener3.mock.calls.length).toBe(3)
    expect(listener4.mock.calls.length).toBe(1)
  })

  it('provides an up-to-date state when a subscriber is notified', done => {
    const store = createStore(reducers.todos)
    store.subscribe(() => {
      expect(store.getState()).toEqual([
        {
          id: 1,
          text: 'Hello'
        }
      ])
      done()
    })
    store.dispatch(addTodo('Hello'))
  })

  it('does not leak private listeners array', done => {
    const store = createStore(reducers.todos)
    store.subscribe(function (this: any) {
      expect(this).toBe(undefined)
      done()
    })
    store.dispatch(addTodo('Hello'))
  })

  it('only accepts plain object actions', () => {
    const store = createStore(reducers.todos)
    expect(() => store.dispatch(unknownAction())).not.toThrow()

    function AwesomeMap() {}
    // @ts-expect-error
    ;[null, undefined, 42, 'hey', new AwesomeMap()].forEach(nonObject =>
      expect(() => store.dispatch(nonObject)).toThrow(/plain/)
    )
  })

  it('handles nested dispatches gracefully', () => {
    function foo(state = 0, action: Action) {
      return action.type === 'foo' ? 1 : state
    }

    function bar(state = 0, action: Action) {
      return action.type === 'bar' ? 2 : state
    }

    const store = createStore(combineReducers({ foo, bar }))

    store.subscribe(function kindaComponentDidUpdate() {
      const state = store.getState()
      if (state.bar === 0) {
        store.dispatch({ type: 'bar' })
      }
    })

    store.dispatch({ type: 'foo' })
    expect(store.getState()).toEqual({
      foo: 1,
      bar: 2
    })
  })

  it('does not allow dispatch() from within a reducer', () => {
    const store = createStore(reducers.dispatchInTheMiddleOfReducer)

    expect(() =>
      store.dispatch(
        dispatchInMiddle(store.dispatch.bind(store, unknownAction()))
      )
    ).toThrow(/may not dispatch/)

    expect(() => store.dispatch(dispatchInMiddle(() => {}))).not.toThrow()
  })

  it('does not allow getState() from within a reducer', () => {
    const store = createStore(reducers.getStateInTheMiddleOfReducer)

    expect(() =>
      store.dispatch(getStateInMiddle(store.getState.bind(store)))
    ).toThrow(/You may not call store.getState()/)

    expect(() => store.dispatch(getStateInMiddle(() => {}))).not.toThrow()
  })

  it('does not allow subscribe() from within a reducer', () => {
    const store = createStore(reducers.subscribeInTheMiddleOfReducer)

    expect(() =>
      store.dispatch(subscribeInMiddle(store.subscribe.bind(store, () => {})))
    ).toThrow(/You may not call store.subscribe()/)

    expect(() => store.dispatch(subscribeInMiddle(() => {}))).not.toThrow()
  })

  it('does not allow unsubscribe from subscribe() from within a reducer', () => {
    const store = createStore(reducers.unsubscribeInTheMiddleOfReducer)
    const unsubscribe = store.subscribe(() => {})

    expect(() =>
      store.dispatch(unsubscribeInMiddle(unsubscribe.bind(store)))
    ).toThrow(/You may not unsubscribe from a store/)

    expect(() => store.dispatch(unsubscribeInMiddle(() => {}))).not.toThrow()
  })

  it('recovers from an error within a reducer', () => {
    const store = createStore(reducers.errorThrowingReducer)
    expect(() => store.dispatch(throwError())).toThrow()

    expect(() => store.dispatch(unknownAction())).not.toThrow()
  })

  it('throws if action type is missing', () => {
    const store = createStore(reducers.todos)
    // @ts-expect-error
    expect(() => store.dispatch({})).toThrow(
      /Actions may not have an undefined "type" property/
    )
  })

  it('throws an error that correctly describes the type of item dispatched', () => {
    const store = createStore(reducers.todos)
    // @ts-ignore
    expect(() => store.dispatch(Promise.resolve(42))).toThrow(
      /the actual type was: 'Promise'/
    )

    // @ts-ignore
    expect(() => store.dispatch(() => {})).toThrow(
      /the actual type was: 'function'/
    )

    // @ts-ignore
    expect(() => store.dispatch(new Date())).toThrow(
      /the actual type was: 'date'/
    )

    // @ts-ignore
    expect(() => store.dispatch(null)).toThrow(/the actual type was: 'null'/)

    // @ts-ignore
    expect(() => store.dispatch(undefined)).toThrow(
      /the actual type was: 'undefined'/
    )
  })

  it('throws if action type is undefined', () => {
    const store = createStore(reducers.todos)
    expect(() => store.dispatch({ type: undefined })).toThrow(
      /Actions may not have an undefined "type" property/
    )
  })

  it('does not throw if action type is falsy', () => {
    const store = createStore(reducers.todos)
    expect(() => store.dispatch({ type: false })).not.toThrow()
    expect(() => store.dispatch({ type: 0 })).not.toThrow()
    expect(() => store.dispatch({ type: null })).not.toThrow()
    expect(() => store.dispatch({ type: '' })).not.toThrow()
  })

  it('accepts enhancer as the third argument', () => {
    const emptyArray: any[] = []
    const spyEnhancer =
      (vanillaCreateStore: any) =>
      (...args: any[]) => {
        expect(args[0]).toBe(reducers.todos)
        expect(args[1]).toBe(emptyArray)
        expect(args.length).toBe(2)
        const vanillaStore = vanillaCreateStore(...args)
        return {
          ...vanillaStore,
          dispatch: jest.fn(vanillaStore.dispatch)
        }
      }

    const store = createStore(reducers.todos, emptyArray, spyEnhancer)
    const action = addTodo('Hello')
    store.dispatch(action)
    expect(store.dispatch).toBeCalledWith(action)
    expect(store.getState()).toEqual([
      {
        id: 1,
        text: 'Hello'
      }
    ])
  })

  it('accepts enhancer as the second argument if initial state is missing', () => {
    const spyEnhancer =
      (vanillaCreateStore: any) =>
      (...args: any[]) => {
        expect(args[0]).toBe(reducers.todos)
        expect(args[1]).toBe(undefined)
        expect(args.length).toBe(2)
        const vanillaStore = vanillaCreateStore(...args)
        return {
          ...vanillaStore,
          dispatch: jest.fn(vanillaStore.dispatch)
        }
      }

    const store = createStore(reducers.todos, spyEnhancer)
    const action = addTodo('Hello')
    store.dispatch(action)
    expect(store.dispatch).toBeCalledWith(action)
    expect(store.getState()).toEqual([
      {
        id: 1,
        text: 'Hello'
      }
    ])
  })

  it('throws if enhancer is neither undefined nor a function', () => {
    expect(() =>
      createStore(reducers.todos, undefined, {} as unknown as StoreEnhancer)
    ).toThrow()

    expect(() =>
      createStore(reducers.todos, undefined, [] as unknown as StoreEnhancer)
    ).toThrow()

    // @ts-expect-error
    expect(() => createStore(reducers.todos, undefined, null)).toThrow()

    expect(() =>
      createStore(reducers.todos, undefined, false as unknown as StoreEnhancer)
    ).toThrow()

    expect(() =>
      createStore(reducers.todos, undefined, undefined)
    ).not.toThrow()

    expect(() => createStore(reducers.todos, undefined, x => x)).not.toThrow()

    expect(() => createStore(reducers.todos, x => x)).not.toThrow()

    expect(() => createStore(reducers.todos, [])).not.toThrow()

    expect(() =>
      createStore<any, Action, {}, {}>(reducers.todos, {})
    ).not.toThrow()
  })

  it('throws if nextReducer is not a function', () => {
    const store = createStore(reducers.todos)

    // @ts-expect-error
    expect(() => store.replaceReducer(undefined)).toThrow(
      'Expected the nextReducer to be a function.'
    )

    expect(() => store.replaceReducer(() => [])).not.toThrow()
  })

  it('throws if listener is not a function', () => {
    const store = createStore(reducers.todos)
    // @ts-expect-error
    expect(() => store.subscribe(undefined)).toThrow()
    // @ts-expect-error
    expect(() => store.subscribe('')).toThrow()
    // @ts-expect-error
    expect(() => store.subscribe(null)).toThrow()
    // @ts-expect-error
    expect(() => store.subscribe(undefined)).toThrow()
  })

  describe('Symbol.observable interop point', () => {
    it('should exist', () => {
      const store = createStore(() => {})
      // @ts-expect-error
      expect(typeof store[$$observable]).toBe('function')
    })

    describe('returned value', () => {
      it('should be subscribable', () => {
        const store = createStore(() => {})
        // @ts-expect-error
        const obs = store[$$observable]()
        expect(typeof obs.subscribe).toBe('function')
      })

      it('may be used to retrieve itself', () => {
        const store = createStore(() => {})
        // @ts-expect-error
        const obs = store[$$observable]()
        expect(obs[$$observable]()).toBe(obs)
      })

      it('should throw a TypeError if an observer object is not supplied to subscribe', () => {
        const store = createStore(() => {})
        // @ts-expect-error
        const obs = store[$$observable]()

        expect(function () {
          obs.subscribe()
        }).toThrowError(
          new TypeError(
            `Expected the observer to be an object. Instead, received: 'undefined'`
          )
        )

        expect(function () {
          obs.subscribe(null)
        }).toThrowError(
          new TypeError(
            `Expected the observer to be an object. Instead, received: 'null'`
          )
        )

        expect(function () {
          obs.subscribe(() => {})
        }).toThrowError(
          new TypeError(
            `Expected the observer to be an object. Instead, received: 'function'`
          )
        )

        expect(function () {
          obs.subscribe({})
        }).not.toThrow()
      })

      it('should return a subscription object when subscribed', () => {
        const store = createStore(() => {})
        // @ts-expect-error
        const obs = store[$$observable]()
        const sub = obs.subscribe({})
        expect(typeof sub.unsubscribe).toBe('function')
      })
    })

    it('should pass an integration test with no unsubscribe', () => {
      function foo(state = 0, action: Action) {
        return action.type === 'foo' ? 1 : state
      }

      function bar(state = 0, action: Action) {
        return action.type === 'bar' ? 2 : state
      }

      const store = createStore(combineReducers({ foo, bar }))
      // @ts-expect-error
      const observable = store[$$observable]()
      const results: any[] = []

      observable.subscribe({
        next(state: any) {
          results.push(state)
        }
      })

      store.dispatch({ type: 'foo' })
      store.dispatch({ type: 'bar' })

      expect(results).toEqual([
        { foo: 0, bar: 0 },
        { foo: 1, bar: 0 },
        { foo: 1, bar: 2 }
      ])
    })

    it('should pass an integration test with an unsubscribe', () => {
      function foo(state = 0, action: Action) {
        return action.type === 'foo' ? 1 : state
      }

      function bar(state = 0, action: Action) {
        return action.type === 'bar' ? 2 : state
      }

      const store = createStore(combineReducers({ foo, bar }))
      // @ts-expect-error
      const observable = store[$$observable]()
      const results: any[] = []

      const sub = observable.subscribe({
        next(state: any) {
          results.push(state)
        }
      })

      store.dispatch({ type: 'foo' })
      sub.unsubscribe()
      store.dispatch({ type: 'bar' })

      expect(results).toEqual([
        { foo: 0, bar: 0 },
        { foo: 1, bar: 0 }
      ])
    })

    it('should pass an integration test with a common library (RxJS)', () => {
      function foo(state = 0, action: Action) {
        return action.type === 'foo' ? 1 : state
      }

      function bar(state = 0, action: Action) {
        return action.type === 'bar' ? 2 : state
      }

      const store: ObservableInput<{ foo: number; bar: number }> = createStore(
        combineReducers({ foo, bar })
      )
      const observable = from(store)
      const results: any[] = []

      const sub = observable
        .pipe(map(state => ({ fromRx: true, ...state })))
        .subscribe(state => results.push(state))
      ;(store as unknown as Store).dispatch({ type: 'foo' })
      sub.unsubscribe()
      ;(store as unknown as Store).dispatch({ type: 'bar' })

      expect(results).toEqual([
        { foo: 0, bar: 0, fromRx: true },
        { foo: 1, bar: 0, fromRx: true }
      ])
    })
  })

  it('does not log an error if parts of the current state will be ignored by a nextReducer using combineReducers', () => {
    const originalConsoleError = console.error
    console.error = jest.fn()

    const store = createStore(
      combineReducers({
        x: (s = 0, _) => s,
        y: combineReducers({
          z: (s = 0, _) => s,
          w: (s = 0, _) => s
        })
      })
    )

    store.replaceReducer(
      combineReducers({
        y: combineReducers({
          z: (s = 0, _) => s
        })
      })
    )

    expect((console.error as any).mock.calls.length).toBe(0)
    console.error = originalConsoleError
  })

  it('throws if passing several enhancer functions without preloaded state', () => {
    const rootReducer = combineReducers(reducers)
    const dummyEnhancer = (f: any) => f
    expect(() =>
      // use a fake pre-loaded state to get a valid createStore signature
      createStore(rootReducer, dummyEnhancer as unknown as {}, dummyEnhancer)
    ).toThrow()
  })

  it('throws if passing several enhancer functions with preloaded state', () => {
    const rootReducer = combineReducers(reducers)
    const dummyEnhancer = (f: any) => f
    expect(() =>
      // work around the type so we can call this poorly
      (createStore as any)(
        rootReducer,
        { todos: [] },
        dummyEnhancer,
        dummyEnhancer
      )
    ).toThrow()
  })
})

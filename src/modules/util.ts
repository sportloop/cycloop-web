/* eslint-disable import/prefer-default-export */
import { all } from "redux-saga/effects";
import { Selector, Action, createSelector } from "@reduxjs/toolkit";
import { useSelector, useDispatch } from "react-redux";
import { useCallback } from "react";

export const combineSagas = <T extends unknown[]>(sagas: T) => {
  return function* combinedSaga() {
    yield all(sagas);
  };
};

type SelectorsFromSubselectors<S, T> = S extends Selector<infer A, infer R>
  ? {
      [key in keyof T]: T[key] extends (s: R) => infer SR
        ? (s: A) => SR
        : never;
    }
  : never;

export const createSelectors = <
  S extends Selector<any, any>,
  SS extends { [key: string]: (s: ReturnType<S>) => any }
>(
  stateSelector: S,
  subSelectors: SS
) => {
  return Object.keys(subSelectors).reduce((selectors, subSelectorName) => {
    return {
      ...selectors,
      [subSelectorName]: createSelector(
        stateSelector,
        subSelectors[subSelectorName]
      ),
    };
  }, {}) as SelectorsFromSubselectors<S, SS>;
};

type HooksFromSelectors<Selectors> = {
  [key in keyof Selectors]: Selectors[key] extends Selector<any, infer T>
    ? () => T
    : never;
};

export const createSelectorHooks = <T>(selectors: T) => {
  return Object.keys(selectors).reduce((hooks, selectorName) => {
    return {
      ...hooks,
      [selectorName]: () => useSelector(selectors[selectorName]),
    };
  }, {} as HooksFromSelectors<T>);
};

type HooksFromActions<Actions> = {
  [key in keyof Actions]: Actions[key] extends (arg: infer Arg) => Action
    ? () => (arg?: Arg) => void
    : never;
};

export const createActionHooks = <T>(actions: T) => {
  return Object.keys(actions).reduce((hooks, actionName) => {
    return {
      ...hooks,
      [actionName]: () => {
        const dispatch = useDispatch();
        return useCallback(
          (arg) => {
            dispatch(actions[actionName](arg));
          },
          [dispatch]
        );
      },
    };
  }, {}) as HooksFromActions<T>;
};

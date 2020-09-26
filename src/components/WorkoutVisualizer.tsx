/* eslint-disable react/jsx-props-no-spreading */
import * as React from "react";
import { FC } from "react";
import { styled } from "linaria/react";

import { Interval, Board, getIntervalColor } from "../modules/workoutEditor";

const Container = styled.div`
  width: 100%;
  overflow-x: auto;
  display: flex;
  height: 100%;
`;

const Scroller = styled.div`
  min-width: ${({ width }: { width: number }) => `${width}rem`};
  width: 100%;
  display: flex;
  height: 100%;
  scroll-snap-type: x mandatory;
  scroll-snap-align: center;
`;
export type SectionVisualizerProps = {
  intervals: Interval[];
  minWidth?: number;
  selected?: string;
  height?: number;
  onSelect?: (id: string) => void;
};

const intervalToPathFunction = (
  interval: Interval,
  height: number,
  x: number
) => {
  return `M ${x},${height}l 0,${-1 * interval.from}l ${interval.duration},${
    -1 * (interval.to - interval.from)
  }l 0,${interval.to}`;
};

type IntervalProps = {
  interval: Interval;
  height: number;
  selected?: boolean;
  onClick?: () => void;
};

const IntervalVisualizer: FC<IntervalProps> = ({
  interval,
  height,
  selected = false,
  onClick,
}) => {
  return (
    <svg
      viewBox={`0 0 ${interval.duration} ${height}`}
      preserveAspectRatio="none"
      style={{ flex: interval.duration }}
      onClick={onClick}
    >
      <path
        fill={selected ? "white" : getIntervalColor(interval)}
        d={intervalToPathFunction(interval, height, 0)}
      />
    </svg>
  );
};

const SectionVisualizer = ({
  intervals,
  selected = null,
  height,
  onSelect,
}: SectionVisualizerProps) => {
  const dimensions = intervals.reduce(
    (total, interval) => ({
      width: total.width + interval.duration,
      height: Math.max(total.height, interval.from, interval.to),
      shortest: Math.min(total.shortest, interval.duration),
    }),
    { width: 0, height: 0, shortest: Infinity }
  );
  return (
    <>
      {intervals.map((interval) => (
        <IntervalVisualizer
          key={interval.id}
          interval={interval}
          height={height || dimensions.height}
          selected={selected === interval.id}
          onClick={() => onSelect?.(interval.id)}
        />
      ))}
    </>
  );
};

type BoardVisualizerProps = {
  board: Board;
  minWidth: number;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
};

const getDimensions = (
  board: Board
): { width: number; height: number; shortest: number } => {
  return board.reduce(
    (dimensions, boardItem) => {
      return {
        width: dimensions.width + boardItem.duration,
        height: Math.max(dimensions.height, boardItem.from, boardItem.to),
        shortest: Math.min(dimensions.shortest, boardItem.duration),
      };
    },
    { width: 0, height: 0, shortest: Infinity }
  );
};

export const BoardVisualizer: FC<BoardVisualizerProps> = ({
  board,
  minWidth = 0,
  selectedIds = [],
  onSelect = () => undefined,
}) => {
  const dimensions = getDimensions(board);
  return (
    <Container>
      <Scroller width={dimensions.width * (minWidth / dimensions.shortest)}>
        {board.map((item) => {
          return (
            <IntervalVisualizer
              key={item.id}
              interval={item}
              height={dimensions.height}
              selected={selectedIds.includes(item.id)}
              onClick={() => onSelect(item.id)}
            />
          );
        })}
      </Scroller>
    </Container>
  );
};

export default SectionVisualizer;

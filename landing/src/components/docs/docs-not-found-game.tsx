"use client";

import { Maximize2, Minimize2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
];
const COLS = 17;
const ROWS = 13;
const TICK_MS = 180;
const CELL_SIZE_DEFAULT = 18;
const CELL_SIZE_FULLSCREEN = 24;

type Dir = "up" | "down" | "left" | "right";

function useKonami(onMatch: () => void) {
  const idx = useRef(0);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === KONAMI[idx.current]) {
        idx.current += 1;
        if (idx.current === KONAMI.length) {
          idx.current = 0;
          onMatch();
        }
      } else {
        idx.current = 0;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onMatch]);
}

function randomCell(): [number, number] {
  return [Math.floor(Math.random() * COLS), Math.floor(Math.random() * ROWS)];
}

function useSnakeGame() {
  const [snake, setSnake] = useState<[number, number][]>([
    [Math.floor(COLS / 2), Math.floor(ROWS / 2)],
  ]);
  const [food, setFood] = useState<[number, number]>(() => randomCell());
  const [dead, setDead] = useState(false);
  const [score, setScore] = useState(0);
  const nextDir = useRef<Dir>("right");

  const reset = useCallback(() => {
    setSnake([[Math.floor(COLS / 2), Math.floor(ROWS / 2)]]);
    setFood(randomCell());
    nextDir.current = "right";
    setDead(false);
    setScore(0);
  }, []);

  useEffect(() => {
    if (dead) return;

    const id = setInterval(() => {
      setSnake((body) => {
        const head = body[0];
        if (!head) return body;
        const d = nextDir.current;
        const dx = d === "left" ? -1 : d === "right" ? 1 : 0;
        const dy = d === "up" ? -1 : d === "down" ? 1 : 0;
        const nx = (head[0] + dx + COLS) % COLS;
        const ny = (head[1] + dy + ROWS) % ROWS;
        const newHead: [number, number] = [nx, ny];
        const hitSelf = body.some((s) => s[0] === nx && s[1] === ny);
        if (hitSelf) {
          setDead(true);
          return body;
        }
        const eat = food[0] === nx && food[1] === ny;
        if (eat) {
          setScore((s) => s + 1);
          setFood(randomCell());
          return [newHead, ...body];
        }
        return [newHead, ...body.slice(0, -1)];
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [dead, food]);

  useEffect(() => {
    if (dead) return;
    function handleKey(e: KeyboardEvent) {
      const key = e.key;
      if ((key === "ArrowUp" || key === "KeyW") && nextDir.current !== "down")
        nextDir.current = "up";
      else if ((key === "ArrowDown" || key === "KeyS") && nextDir.current !== "up")
        nextDir.current = "down";
      else if ((key === "ArrowLeft" || key === "KeyA") && nextDir.current !== "right")
        nextDir.current = "left";
      else if ((key === "ArrowRight" || key === "KeyD") && nextDir.current !== "left")
        nextDir.current = "right";
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [dead]);

  return { snake, food, dead, score, reset };
}

export function DocsNotFoundGame() {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const { snake, food, dead, score, reset } = useSnakeGame();

  useKonami(useCallback(() => setOpen(true), []));

  const close = useCallback(() => {
    setOpen(false);
    setFullscreen(false);
    reset();
  }, [reset]);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((prev) => !prev);
  }, []);

  if (!open) return null;

  const snakeSet = new Set(snake.map(([x, y]) => `${x},${y}`));
  const foodKey = `${food[0]},${food[1]}`;
  const cellSize = fullscreen ? CELL_SIZE_FULLSCREEN : CELL_SIZE_DEFAULT;
  const gridW = COLS * cellSize + 16;
  const gridH = ROWS * cellSize + 16;

  return (
    <div
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-2 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label="Snake game"
    >
      <div
        className={cn(
          "bg-fd-card border-fd-border flex flex-col overflow-hidden rounded-2xl border shadow-xl transition-[width,height,max-width,max-height] duration-300",
          fullscreen
            ? "h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[min(calc(100vw-1rem),42rem)] max-w-[min(calc(100vw-1rem),42rem)]"
            : "max-h-[85dvh] w-full max-w-[380px]",
        )}
      >
        <div className="bg-fd-muted/80 border-fd-border flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="bg-fd-muted text-fd-muted-foreground rounded-md px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase">
              Snake
            </span>
            <span className="text-fd-muted-foreground text-xs font-medium">Score: {score}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            >
              {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={close}
              aria-label="Close game"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="bg-fd-muted/40 border-fd-border flex min-h-0 flex-1 flex-col items-center justify-center gap-0 border-t p-4">
          <div className="bg-fd-muted/60 border-fd-border flex flex-col items-center justify-center rounded-xl border-2 p-3 shadow-inner">
            <div
              className="docs-crt-screen bg-background border-fd-border relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border shadow-inner transition-opacity hover:opacity-95 active:opacity-90"
              style={{ minWidth: gridW, minHeight: gridH }}
              onClick={toggleFullscreen}
              onKeyDown={(e) => e.key === "Enter" && toggleFullscreen()}
              role="button"
              tabIndex={0}
              title="Click to expand"
              aria-label="Game screen; click to expand or shrink"
            >
              <div
                className="bg-fd-muted/20 grid gap-0 rounded-md p-1"
                style={{
                  gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                  width: gridW - 8,
                  height: gridH - 8,
                }}
              >
                {Array.from({ length: ROWS * COLS }, (_, i) => {
                  const x = i % COLS;
                  const y = Math.floor(i / COLS);
                  const key = `${x},${y}`;
                  const isSnake = snakeSet.has(key);
                  const isFood = key === foodKey;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "rounded-[2px] transition-colors",
                        isSnake && "bg-primary",
                        isFood && "bg-primary rounded-full",
                        !isSnake && !isFood && "bg-transparent",
                      )}
                      style={{ width: cellSize - 2, height: cellSize - 2 }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-3 flex min-h-[4.5rem] flex-col items-center justify-center gap-2">
            {dead ? (
              <>
                <p className="text-fd-foreground text-sm font-medium">Game over</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={reset}>
                    Play again
                  </Button>
                  <Button size="sm" variant="outline" onClick={close}>
                    Close
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-fd-muted-foreground text-xs">
                Use <kbd className="bg-fd-muted rounded px-1.5 py-0.5 font-mono text-[10px]">←</kbd>{" "}
                <kbd className="bg-fd-muted rounded px-1.5 py-0.5 font-mono text-[10px]">→</kbd>{" "}
                <kbd className="bg-fd-muted rounded px-1.5 py-0.5 font-mono text-[10px]">↑</kbd>{" "}
                <kbd className="bg-fd-muted rounded px-1.5 py-0.5 font-mono text-[10px]">↓</kbd> or{" "}
                <kbd className="bg-fd-muted rounded px-1.5 py-0.5 font-mono text-[10px]">
                  W A S D
                </kbd>{" "}
                to move
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

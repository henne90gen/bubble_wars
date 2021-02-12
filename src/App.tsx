import React, { useRef, useState } from "react";
import "./App.css";
import Canvas from "./Canvas";

const NODE_SIZE = 20;
const POWER_SPEED = 0.0075;

const FACTIONS = ["none", "red", "player"] as const;
type FactionTuple = typeof FACTIONS;
type Faction = FactionTuple[number];

type Node = {
  x: number;
  y: number;
  power: number;
  faction: Faction;
  connections: number[];
};

type Connection = {
  n1: number;
  n2: number;
};

type TravelPower = {
  startNode: number;
  endNode: number;
  power: number;
  faction: Faction;
  t: number;
};

type FactionStatistics = {
  totalPower: number;
  controlledNodes: number;
};
type Statistics = { [key in Faction]: FactionStatistics };

function getFactionColor(faction: Faction): string {
  switch (faction) {
    case null:
      return "#aaaaaa";
    case "red":
      return "#ff0000";
    case "player":
      return "#00ff00";
  }
  return "#aaaaaa";
}

function generateLevel(): [Node[], Connection[]] {
  const nodes = [
    {
      x: 100,
      y: 100,
      faction: "player" as Faction,
      power: 3,
      connections: [1, 3],
    },
    {
      x: 250,
      y: 50,
      faction: "none" as Faction,
      power: 3,
      connections: [0, 2, 3],
    },
    {
      x: 400,
      y: 100,
      faction: "none" as Faction,
      power: 3,
      connections: [1, 3],
    },
    {
      x: 250,
      y: 150,
      faction: "none" as Faction,
      power: 3,
      connections: [0, 1, 2, 4, 6],
    },

    {
      x: 100,
      y: 250,
      faction: "none" as Faction,
      power: 3,
      connections: [3, 5],
    },
    {
      x: 250,
      y: 300,
      faction: "red" as Faction,
      power: 3,
      connections: [4, 6],
    },
    {
      x: 400,
      y: 250,
      faction: "none" as Faction,
      power: 3,
      connections: [3, 5],
    },
  ];

  const connections = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = 0; j < nodes[i].connections.length; j++) {
      const con = { n1: i, n2: nodes[i].connections[j] };
      let alreadyExists = false;
      for (const existingCon of connections) {
        if (
          (con.n1 === existingCon.n1 && con.n2 === existingCon.n2) ||
          (con.n1 === existingCon.n2 && con.n2 === existingCon.n1)
        ) {
          alreadyExists = true;
          break;
        }
      }
      if (!alreadyExists) {
        connections.push(con);
      }
    }
  }

  return [nodes, connections];
}

function App() {
  const [initialNodes, initialConnections] = generateLevel();

  const nodesRef = useRef<Node[]>(initialNodes);
  const connectionsRef = useRef<Connection[]>(initialConnections);
  const travelingPower = useRef<TravelPower[]>([]);
  const selectedNode = useRef<number | null>(null);

  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [stats, setStats] = useState<Statistics>({
    none: { totalPower: 3, controlledNodes: 1 },
    player: { totalPower: 3, controlledNodes: 1 },
    red: { totalPower: 3, controlledNodes: 1 },
  });

  const findClickedNode = (mouseX: number, mouseY: number): number | null => {
    const sHalf = NODE_SIZE / 2;
    for (let i = 0; i < nodesRef.current.length; i++) {
      const { x, y } = nodesRef.current[i];
      if (
        x - sHalf < mouseX &&
        x + sHalf > mouseX &&
        y - sHalf < mouseY &&
        y + sHalf > mouseY
      ) {
        return i;
      }
    }
    return null;
  };

  const clicked = (mouseX: number, mouseY: number) => {
    const previousSelectedNode = selectedNode.current;
    selectedNode.current = findClickedNode(mouseX, mouseY);
    if (selectedNode.current === null || previousSelectedNode === null) {
      return;
    }

    const previousNode = nodesRef.current[previousSelectedNode];
    if (previousNode.faction !== "player") {
      return;
    }

    let foundOtherNode = false;
    for (const con of previousNode.connections) {
      if (selectedNode.current === con) {
        foundOtherNode = true;
        break;
      }
    }
    if (!foundOtherNode) {
      return;
    }

    travelingPower.current.push({
      startNode: previousSelectedNode,
      endNode: selectedNode.current,
      power: previousNode.power,
      faction: previousNode.faction,
      t: 0.0,
    });
    previousNode.power = 0;
    selectedNode.current = null;
  };

  const updateTravelingPower = () => {
    const arrivedPower = [];
    for (let i = 0; i < travelingPower.current.length; i++) {
      const tPower = travelingPower.current[i];
      tPower.t += POWER_SPEED;
      if (tPower.t >= 1.0) {
        arrivedPower.push(i);
      }
    }

    for (const i of arrivedPower.sort((a, b) => b - a)) {
      const tPower = travelingPower.current[i];
      const endNode = nodesRef.current[tPower.endNode];
      if (endNode.faction === tPower.faction) {
        endNode.power += tPower.power;
      } else {
        endNode.power -= tPower.power;
        if (endNode.power <= 0) {
          endNode.power = Math.abs(endNode.power);
          endNode.faction = tPower.faction;
        }
      }
      travelingPower.current.splice(i, 1);
    }
  };

  const doAI = () => {
    for (let i = 0; i < nodesRef.current.length; i++) {
      if (
        nodesRef.current[i].faction === "none" ||
        nodesRef.current[i].faction === "player"
      ) {
        continue;
      }

      const queue: { cur: number; prev: number; cost: number }[] = [];
      const parents = new Map<number, { parent: number; cost: number }>();
      const goals: { goal: number; cost: number }[] = [];
      const visited = new Set<number>();

      for (const con of nodesRef.current[i].connections) {
        queue.push({ cur: con, prev: i, cost: 1 });
        parents.set(i, { parent: -1, cost: 0 });
      }

      while (queue.length > 0) {
        const element = queue.pop();
        if (element === undefined) {
          break;
        }

        const { cur, prev, cost } = element;
        if (visited.has(cur)) {
          const parent = parents.get(cur);
          if (parent === undefined) {
            parents.set(cur, { parent: prev, cost: cost });
          } else if (parent.cost > cost) {
            parents.set(cur, { parent: prev, cost: cost });
          } else {
            continue;
          }

          for (const con of nodesRef.current[cur].connections) {
            queue.push({ cur: con, prev: cur, cost: cost + 1 });
          }

          continue;
        }

        visited.add(cur);

        if (nodesRef.current[cur].faction === "red") {
          for (const con of nodesRef.current[cur].connections) {
            queue.push({ cur: con, prev: cur, cost: cost + 1 });
          }
        } else {
          goals.push({ goal: cur, cost });
        }
      }

      goals.sort((a, b) => a.cost - b.cost);
      if (goals.length === 0) {
        continue;
      }

      const g = goals[0];
      if (g === undefined) {
        continue;
      }
      const { goal } = g;

      const neighbors = new Set<number>();
      for (const neighbor of nodesRef.current[i].connections) {
        neighbors.add(neighbor);
      }

      if (neighbors.has(goal)) {
        if (
          (nodesRef.current[goal].faction === "red" &&
            nodesRef.current[i].power > 0) ||
          nodesRef.current[i].power > nodesRef.current[goal].power
        ) {
          travelingPower.current.push({
            startNode: i,
            endNode: goal,
            power: nodesRef.current[i].power,
            faction: nodesRef.current[i].faction,
            t: 0.0,
          });
          nodesRef.current[i].power = 0;
        }
      } else {
        let currentNode = goal;
        while (true) {
          if (neighbors.has(currentNode)) {
            if (
              (nodesRef.current[currentNode].faction === "red" &&
                nodesRef.current[i].power > 0) ||
              nodesRef.current[i].power > nodesRef.current[currentNode].power
            ) {
              travelingPower.current.push({
                startNode: i,
                endNode: currentNode,
                power: nodesRef.current[i].power,
                faction: nodesRef.current[i].faction,
                t: 0.0,
              });
              nodesRef.current[i].power = 0;
            }
            break;
          }
          const parent = parents.get(currentNode);
          if (parent === undefined) {
            break;
          }
          currentNode = parent.parent;
        }
      }
    }
  };

  const update = (frameCount: number) => {
    if (frameCount % 60 === 0) {
      const newStats: Statistics = {
        none: { totalPower: 0, controlledNodes: 0 },
        red: { totalPower: 0, controlledNodes: 0 },
        player: { totalPower: 0, controlledNodes: 0 },
      };
      for (const node of nodesRef.current) {
        newStats[node.faction].controlledNodes++;
        newStats[node.faction].totalPower += node.power;
      }
      for (const travel of travelingPower.current) {
        newStats[travel.faction].totalPower += travel.power;
      }
      setStats(newStats);
    }

    if (frameCount % 50 === 0) {
      for (let i = 0; i < nodesRef.current.length; i++) {
        if (nodesRef.current[i].faction === "none") {
          continue;
        }
        nodesRef.current[i].power++;
      }
    }

    doAI();
    updateTravelingPower();
  };

  const render = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (const { n1, n2 } of connectionsRef.current) {
      const node1 = nodesRef.current[n1];
      const node2 = nodesRef.current[n2];
      ctx.beginPath();
      ctx.moveTo(node1.x, node1.y);
      ctx.lineTo(node2.x, node2.y);
      ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < travelingPower.current.length; i++) {
      const { startNode, endNode, power, faction, t } = travelingPower.current[
        i
      ];
      const nStart = nodesRef.current[startNode];
      const nEnd = nodesRef.current[endNode];
      const x = nStart.x * (1 - t) + nEnd.x * t;
      const y = nStart.y * (1 - t) + nEnd.y * t;

      ctx.fillStyle = getFactionColor(faction);
      ctx.beginPath();
      ctx.arc(x, y, NODE_SIZE / 2, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "#000000";
      ctx.fillText(power.toFixed(0), x, y);
    }

    for (let i = 0; i < nodesRef.current.length; i++) {
      const { x, y, power, faction } = nodesRef.current[i];

      if (selectedNode.current === i) {
        ctx.fillStyle = "#000000";
        const size = NODE_SIZE * 1.1;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }

      ctx.fillStyle = getFactionColor(faction);
      ctx.fillRect(x - NODE_SIZE / 2, y - NODE_SIZE / 2, NODE_SIZE, NODE_SIZE);

      ctx.fillStyle = "#000000";
      ctx.fillText(power.toFixed(0), x, y);
      ctx.fillText(i.toFixed(0), x + 15, y);
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, frameCount: number) => {
    if (isPaused) {
      return;
    }

    update(frameCount);
    render(ctx);
  };

  return (
    <div
      style={{
        borderStyle: "solid",
        borderWidth: "1px",
        borderColor: "black",
        width: "500px",
        height: "500px",
      }}
    >
      <Canvas
        width="500px"
        height="500px"
        onClick={(event) => {
          const mouseX = event.clientX;
          const mouseY = event.clientY;
          clicked(mouseX, mouseY);
        }}
        draw={draw}
      />
      <button onClick={() => setIsPaused(!isPaused)}>
        {isPaused ? "Resume" : "Pause"}
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div>Faction</div>
        <div>Total Power</div>
        <div>Controlled Nodes</div>
        {FACTIONS.map((f: Faction) => {
          const s = stats[f];
          return (
            <>
              <div>{f}</div>
              <div>{s.totalPower}</div>
              <div>{s.controlledNodes}</div>
            </>
          );
        })}
      </div>
    </div>
  );
}

export default App;

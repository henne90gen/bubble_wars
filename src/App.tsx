import React, { useRef, useState } from "react";
import { updateSourceFile } from "typescript";
import "./App.css";
import Canvas from "./Canvas";

const NODE_SIZE = 20;
const POWER_SPEED = 0.0075;

type Faction = null | "red" | "player";

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

type Statistics = {};

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
    { x: 250, y: 50, faction: null, power: 3, connections: [0, 2, 3] },
    { x: 400, y: 100, faction: null, power: 3, connections: [1, 3] },
    { x: 250, y: 150, faction: null, power: 3, connections: [0, 1, 2, 4, 6] },

    { x: 100, y: 250, faction: null, power: 3, connections: [3, 5] },
    {
      x: 250,
      y: 300,
      faction: "red" as Faction,
      power: 3,
      connections: [4, 6],
    },
    { x: 400, y: 250, faction: null, power: 3, connections: [3, 5] },
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

  const [stats, setStats] = useState<Statistics>({});

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

  const update = (frameCount: number) => {
    if (frameCount % 60 === 0) {
      let newStats = {};
      setStats(newStats);
    }

    if (frameCount % 50 === 0) {
      for (let i = 0; i < nodesRef.current.length; i++) {
        if (nodesRef.current[i].faction === null) {
          continue;
        }
        nodesRef.current[i].power++;
      }
    }

    const arrivedPower = [];
    for (let i = 0; i < travelingPower.current.length; i++) {
      const tPower = travelingPower.current[i];
      tPower.t += POWER_SPEED;
      if (tPower.t >= 1.0) {
        arrivedPower.push(i);
      }
    }

    for (const i of arrivedPower) {
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

  const draw = (ctx: CanvasRenderingContext2D, frameCount: number) => {
    update(frameCount);

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
    }
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
    </div>
  );
}

export default App;

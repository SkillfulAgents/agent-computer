// CDP target info returned by /json/list endpoint
export interface CDPTarget {
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
  description?: string;
  devtoolsFrontendUrl?: string;
}

// CDP Accessibility Node from Accessibility.getFullAXTree
export interface CDPAXNode {
  nodeId: string;
  ignored: boolean;
  role?: { type: string; value: string };
  name?: { type: string; value: string; sources?: unknown[] };
  description?: { type: string; value: string };
  value?: { type: string; value: unknown };
  properties?: Array<{
    name: string;
    value: { type: string; value: unknown };
  }>;
  childIds?: string[];
  parentId?: string;
  backendDOMNodeId?: number;
}

// What the refMap stores for CDP elements
export interface CDPNodeRef {
  nodeId: string;
  backendDOMNodeId: number;
}

// CDP Box Model from DOM.getBoxModel
export interface CDPBoxModel {
  content: number[];  // quad: [x1,y1, x2,y2, x3,y3, x4,y4]
  padding: number[];
  border: number[];
  margin: number[];
  width: number;
  height: number;
}

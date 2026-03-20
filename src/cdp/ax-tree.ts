import type { CDPConnection } from './connection.js';
import type { CDPAXNode, CDPNodeRef } from './types.js';
import type { Element } from '../types.js';
import { roleToPrefix } from '../refs.js';
import { mapCDPRole, INTERACTIVE_ROLES } from './role-map.js';

const MAX_ELEMENTS = 500;
const MAX_DEPTH = 50;

export interface AXTreeOptions {
  /** CDP tree depth to fetch (default: 0 = full tree). */
  depth?: number;
  /** When true, only return nodes whose CDP role is in INTERACTIVE_ROLES. */
  interactive?: boolean;
}

export interface AXTreeResult {
  elements: Element[];
  refMap: Map<string, CDPNodeRef>;
}

export class CDPAXTree {
  private connection: CDPConnection;

  constructor(connection: CDPConnection) {
    this.connection = connection;
  }

  async getTree(options: AXTreeOptions = {}): Promise<AXTreeResult> {
    const { depth, interactive = false } = options;

    const params: Record<string, unknown> = {};
    if (depth !== undefined) {
      params.depth = depth;
    }

    const result = (await this.connection.send(
      'Accessibility.getFullAXTree',
      params,
    )) as { nodes: CDPAXNode[] };

    const nodes = result.nodes;
    if (!nodes || nodes.length === 0) {
      return { elements: [], refMap: new Map() };
    }

    // Build a lookup map: nodeId → CDPAXNode
    const nodeMap = new Map<string, CDPAXNode>();
    for (const node of nodes) {
      nodeMap.set(node.nodeId, node);
    }

    // Ref counter per prefix
    const refCounters: Record<string, number> = {};
    const refMap = new Map<string, CDPNodeRef>();
    let totalElements = 0;

    const buildElement = (
      node: CDPAXNode,
      currentDepth: number,
    ): Element | null => {
      if (totalElements >= MAX_ELEMENTS) return null;
      if (currentDepth > MAX_DEPTH) return null;

      // Skip ignored nodes — parent's buildChildren handles grandchild collection
      if (node.ignored) {
        return null;
      }

      const cdpRole = node.role?.value ?? 'generic';
      const mappedRole = mapCDPRole(cdpRole);

      // In interactive mode, check if this node's CDP role qualifies.
      // We still recurse into children of non-interactive nodes.
      if (interactive && !INTERACTIVE_ROLES.has(cdpRole)) {
        const children = buildChildren(node, currentDepth);
        // Promote children of non-interactive nodes
        if (children.length === 1) return children[0];
        if (children.length > 1) {
          // Wrap in a group so children aren't lost
          const prefix = roleToPrefix(mappedRole);
          refCounters[prefix] = (refCounters[prefix] ?? 0) + 1;
          const ref = `@${prefix}${refCounters[prefix]}`;
          totalElements++;

          if (node.backendDOMNodeId !== undefined) {
            refMap.set(ref, {
              nodeId: node.nodeId,
              backendDOMNodeId: node.backendDOMNodeId,
            });
          }

          const element: Element = {
            ref,
            role: mappedRole,
            label: node.name?.value ?? null,
            value: node.value?.value != null ? String(node.value.value) : null,
            enabled: getEnabled(node),
            focused: getFocused(node),
            bounds: [0, 0, 0, 0],
          };
          if (children.length > 0) {
            element.children = children;
          }
          return element;
        }
        return null;
      }

      const prefix = roleToPrefix(mappedRole);
      refCounters[prefix] = (refCounters[prefix] ?? 0) + 1;
      const ref = `@${prefix}${refCounters[prefix]}`;
      totalElements++;

      if (node.backendDOMNodeId !== undefined) {
        refMap.set(ref, {
          nodeId: node.nodeId,
          backendDOMNodeId: node.backendDOMNodeId,
        });
      }

      const children = buildChildren(node, currentDepth);

      const element: Element = {
        ref,
        role: mappedRole,
        label: node.name?.value ?? null,
        value: node.value?.value != null ? String(node.value.value) : null,
        enabled: getEnabled(node),
        focused: getFocused(node),
        bounds: [0, 0, 0, 0],
      };

      if (children.length > 0) {
        element.children = children;
      }

      return element;
    };

    const buildChildren = (
      parent: CDPAXNode,
      currentDepth: number,
    ): Element[] => {
      if (!parent.childIds || parent.childIds.length === 0) return [];
      const children: Element[] = [];
      for (const childId of parent.childIds) {
        if (totalElements >= MAX_ELEMENTS) break;
        const childNode = nodeMap.get(childId);
        if (!childNode) continue;
        const el = buildElement(childNode, currentDepth + 1);
        if (el) {
          children.push(el);
        } else if (childNode.childIds) {
          // If the child was ignored/skipped, collect its grandchildren
          const grandchildren = buildChildren(childNode, currentDepth + 1);
          children.push(...grandchildren);
        }
      }
      return children;
    };

    // Root is the first node
    const root = nodes[0];
    const rootElement = buildElement(root, 0);
    const elements: Element[] = [];

    if (rootElement) {
      // If root is a webarea, return its children directly (common pattern)
      if (rootElement.role === 'webarea' && rootElement.children) {
        elements.push(...rootElement.children);
      } else {
        elements.push(rootElement);
      }
    }

    return { elements, refMap };
  }
}

function getEnabled(node: CDPAXNode): boolean {
  if (!node.properties) return true;
  for (const prop of node.properties) {
    if (prop.name === 'disabled') {
      return !prop.value.value;
    }
  }
  return true;
}

function getFocused(node: CDPAXNode): boolean {
  if (!node.properties) return false;
  for (const prop of node.properties) {
    if (prop.name === 'focused') {
      return !!prop.value.value;
    }
  }
  return false;
}

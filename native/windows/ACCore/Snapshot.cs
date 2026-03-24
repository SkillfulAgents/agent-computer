using System.Windows.Automation;

namespace ACCore;

public class ElementInfo
{
    public string Ref { get; set; } = "";
    public string Role { get; set; } = "";
    public string? Label { get; set; }
    public string? Value { get; set; }
    public bool Enabled { get; set; } = true;
    public bool Focused { get; set; }
    public int[] Bounds { get; set; } = [0, 0, 0, 0];
    public List<ElementInfo>? Children { get; set; }
}

public class SnapshotResult
{
    public string SnapshotId { get; set; } = "";
    public WindowInfo? Window { get; set; }
    public List<ElementInfo> Elements { get; set; } = new();
    public string? Fallback { get; set; }
}

public class SnapshotBuilder
{
    private readonly RefAssigner _refAssigner = new();
    private readonly Dictionary<string, AutomationElement> _refMap = new();
    private int _elementCount;
    private const int MaxElements = 500;
    private const int DefaultMaxDepth = 50;

    public Dictionary<string, AutomationElement> LastRefMap => _refMap;

    public SnapshotResult Build(
        AutomationElement windowElement,
        WindowInfo windowInfo,
        bool interactiveOnly = false,
        int? maxDepth = null,
        string? subtreeRef = null)
    {
        // Resolve subtree element from the previous snapshot's refMap before clearing
        AutomationElement? subtreeEl = null;
        if (subtreeRef != null)
            _refMap.TryGetValue(subtreeRef, out subtreeEl);

        _refAssigner.Reset();
        _refMap.Clear();
        _elementCount = 0;

        var depth = maxDepth ?? DefaultMaxDepth;
        var snapshotId = Guid.NewGuid().ToString("N")[..8];

        AutomationElement root = subtreeEl ?? windowElement;

        var elements = WalkTree(root, depth, interactiveOnly);

        return new SnapshotResult
        {
            SnapshotId = snapshotId,
            Window = windowInfo,
            Elements = elements,
            Fallback = null,
        };
    }

    private List<ElementInfo> WalkTree(AutomationElement element, int maxDepth, bool interactiveOnly, int depth = 0)
    {
        var results = new List<ElementInfo>();
        if (depth > maxDepth || _elementCount >= MaxElements) return results;

        TreeWalker walker = TreeWalker.ControlViewWalker;
        AutomationElement? child;

        try
        {
            child = walker.GetFirstChild(element);
        }
        catch
        {
            return results;
        }

        while (child != null && _elementCount < MaxElements)
        {
            try
            {
                var info = BuildElementInfo(child, interactiveOnly);
                if (info != null)
                {
                    // Recurse into children
                    var childElements = WalkTree(child, maxDepth, interactiveOnly, depth + 1);
                    if (childElements.Count > 0)
                        info.Children = childElements;

                    // In interactive mode, include element if it's interactive OR has interactive descendants
                    if (interactiveOnly)
                    {
                        if (Roles.IsInteractive(info.Role) || (info.Children != null && info.Children.Count > 0))
                        {
                            results.Add(info);
                        }
                    }
                    else
                    {
                        results.Add(info);
                    }
                }
            }
            catch
            {
                // Element became unavailable — skip
            }

            try
            {
                child = walker.GetNextSibling(child);
            }
            catch
            {
                break;
            }
        }

        return results;
    }

    private ElementInfo? BuildElementInfo(AutomationElement element, bool interactiveOnly)
    {
        try
        {
            var controlType = element.Current.ControlType;
            var normalizedRole = Roles.NormalizeRole(controlType);

            // Get label: Name property is the primary label
            string? label = element.Current.Name;
            if (string.IsNullOrEmpty(label)) label = null;

            // Get value
            string? value = null;
            if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var valPattern))
            {
                value = ((ValuePattern)valPattern).Current.Value;
            }
            else if (element.TryGetCurrentPattern(RangeValuePattern.Pattern, out var rangePattern))
            {
                value = ((RangeValuePattern)rangePattern).Current.Value.ToString();
            }
            else if (element.TryGetCurrentPattern(TogglePattern.Pattern, out var togglePattern))
            {
                var state = ((TogglePattern)togglePattern).Current.ToggleState;
                value = state == ToggleState.On ? "1" : "0";
            }
            else if (element.TryGetCurrentPattern(SelectionItemPattern.Pattern, out var selPattern))
            {
                value = ((SelectionItemPattern)selPattern).Current.IsSelected ? "1" : "0";
            }

            // Get bounds
            var rect = element.Current.BoundingRectangle;
            int[] bounds = rect.IsEmpty
                ? [0, 0, 0, 0]
                : [(int)rect.X, (int)rect.Y, (int)rect.Width, (int)rect.Height];

            // Enabled & focused
            bool enabled = element.Current.IsEnabled;
            bool focused = false;
            try { focused = element.Current.HasKeyboardFocus; } catch { }

            // Assign ref
            var refStr = _refAssigner.Assign(normalizedRole);
            _refMap[refStr] = element;
            _elementCount++;

            return new ElementInfo
            {
                Ref = refStr,
                Role = normalizedRole,
                Label = label,
                Value = value,
                Enabled = enabled,
                Focused = focused,
                Bounds = bounds,
            };
        }
        catch
        {
            return null;
        }
    }
}

using System.Collections;
using System.Runtime.InteropServices;
using Com = Interop.UIAutomationClient;

namespace ACCore.Uia;

// A thin, drop-in subset of the System.Windows.Automation API (the WPF managed
// UIA client) implemented over the UIAutomationCore COM interface.
//
// Why: the managed client lives in the WindowsDesktop shared framework, and
// referencing it drags all of WPF (~40 MB uncompressed) into a self-contained
// build — and the trimmer cannot remove it. This shim covers exactly the
// surface ACCore uses, so the daemon ships as a plain console app.

/// <summary>Process-wide UIA client instance. CUIAutomation8 is free-threaded.</summary>
internal static class UiaCore
{
    private static Com.IUIAutomation? s_automation;
    private static readonly object s_lock = new();

    public static Com.IUIAutomation Instance
    {
        get
        {
            if (s_automation != null) return s_automation;
            lock (s_lock)
            {
                s_automation ??= new Com.CUIAutomation8();
                return s_automation;
            }
        }
    }

    /// <summary>Managed UIA threw ElementNotAvailableException; callers catch broadly, so any exception type works.</summary>
    public static T Guard<T>(Func<T> f)
    {
        try { return f(); }
        catch (COMException ex) { throw new ElementNotAvailableException(ex); }
    }
}

public class ElementNotAvailableException : Exception
{
    public ElementNotAvailableException(Exception inner) : base("UI Automation element is no longer available", inner) { }
}

// ---- Identifiers -----------------------------------------------------------

public sealed class AutomationProperty
{
    public int Id { get; }
    public string ProgrammaticName { get; }
    internal AutomationProperty(int id, string name) { Id = id; ProgrammaticName = name; }
    public override string ToString() => ProgrammaticName;
}

public sealed class AutomationPattern
{
    public int Id { get; }
    public string ProgrammaticName { get; }
    internal AutomationPattern(int id, string name) { Id = id; ProgrammaticName = name; }
    public override string ToString() => ProgrammaticName;
}

/// <summary>UIA control type ids (UIA_*ControlTypeId). Ids match System.Windows.Automation.ControlType.*.Id.</summary>
public sealed class ControlType
{
    public int Id { get; }
    public string ProgrammaticName { get; }
    public string LocalizedControlType { get; }

    private ControlType(int id, string name)
    {
        Id = id;
        ProgrammaticName = "ControlType." + name;
        LocalizedControlType = name.ToLowerInvariant();
        s_byId[id] = this;
    }

    private static readonly Dictionary<int, ControlType> s_byId = new();

    public static readonly ControlType Button = new(50000, "Button");
    public static readonly ControlType Calendar = new(50001, "Calendar");
    public static readonly ControlType CheckBox = new(50002, "CheckBox");
    public static readonly ControlType ComboBox = new(50003, "ComboBox");
    public static readonly ControlType Edit = new(50004, "Edit");
    public static readonly ControlType Hyperlink = new(50005, "Hyperlink");
    public static readonly ControlType Image = new(50006, "Image");
    public static readonly ControlType ListItem = new(50007, "ListItem");
    public static readonly ControlType List = new(50008, "List");
    public static readonly ControlType Menu = new(50009, "Menu");
    public static readonly ControlType MenuBar = new(50010, "MenuBar");
    public static readonly ControlType MenuItem = new(50011, "MenuItem");
    public static readonly ControlType ProgressBar = new(50012, "ProgressBar");
    public static readonly ControlType RadioButton = new(50013, "RadioButton");
    public static readonly ControlType ScrollBar = new(50014, "ScrollBar");
    public static readonly ControlType Slider = new(50015, "Slider");
    public static readonly ControlType Spinner = new(50016, "Spinner");
    public static readonly ControlType StatusBar = new(50017, "StatusBar");
    public static readonly ControlType Tab = new(50018, "Tab");
    public static readonly ControlType TabItem = new(50019, "TabItem");
    public static readonly ControlType Text = new(50020, "Text");
    public static readonly ControlType ToolBar = new(50021, "ToolBar");
    public static readonly ControlType ToolTip = new(50022, "ToolTip");
    public static readonly ControlType Tree = new(50023, "Tree");
    public static readonly ControlType TreeItem = new(50024, "TreeItem");
    public static readonly ControlType Custom = new(50025, "Custom");
    public static readonly ControlType Group = new(50026, "Group");
    public static readonly ControlType Thumb = new(50027, "Thumb");
    public static readonly ControlType DataGrid = new(50028, "DataGrid");
    public static readonly ControlType DataItem = new(50029, "DataItem");
    public static readonly ControlType Document = new(50030, "Document");
    public static readonly ControlType SplitButton = new(50031, "SplitButton");
    public static readonly ControlType Window = new(50032, "Window");
    public static readonly ControlType Pane = new(50033, "Pane");
    public static readonly ControlType Header = new(50034, "Header");
    public static readonly ControlType HeaderItem = new(50035, "HeaderItem");
    public static readonly ControlType Table = new(50036, "Table");
    public static readonly ControlType TitleBar = new(50037, "TitleBar");
    public static readonly ControlType Separator = new(50038, "Separator");
    public static readonly ControlType SemanticZoom = new(50039, "SemanticZoom");
    public static readonly ControlType AppBar = new(50040, "AppBar");

    /// <summary>Unknown ids map to Custom, like the managed client's fallback behaviour.</summary>
    public static ControlType LookupById(int id) => s_byId.TryGetValue(id, out var ct) ? ct : Custom;

    public override string ToString() => ProgrammaticName;
}

public enum TreeScope
{
    Element = 1,
    Children = 2,
    Descendants = 4,
    Parent = 8,
    Ancestors = 16,
    Subtree = Element | Children | Descendants,
}

public enum ToggleState { Off = 0, On = 1, Indeterminate = 2 }

public enum ExpandCollapseState { Collapsed = 0, Expanded = 1, PartiallyExpanded = 2, LeafNode = 3 }

/// <summary>Screen-space rectangle with the members of System.Windows.Rect that ACCore reads.</summary>
public readonly struct Rect
{
    public double X { get; }
    public double Y { get; }
    public double Width { get; }
    public double Height { get; }

    public Rect(double x, double y, double width, double height)
    {
        X = x; Y = y; Width = width; Height = height;
    }

    public static Rect Empty { get; } = new(0, 0, 0, 0);

    public double Left => X;
    public double Top => Y;
    public double Right => X + Width;
    public double Bottom => Y + Height;

    /// <summary>UIA reports "no bounds" as an all-zero rect; the managed client turned that into Rect.Empty.</summary>
    public bool IsEmpty => Width <= 0 && Height <= 0;

    public override string ToString() => $"{X},{Y},{Width},{Height}";
}

// ---- Conditions ------------------------------------------------------------

public abstract class Condition
{
    internal abstract Com.IUIAutomationCondition ToCom();

    public static Condition TrueCondition { get; } = new TrueConditionImpl();

    private sealed class TrueConditionImpl : Condition
    {
        internal override Com.IUIAutomationCondition ToCom() => UiaCore.Instance.CreateTrueCondition();
    }
}

public sealed class PropertyCondition : Condition
{
    public AutomationProperty Property { get; }
    public object Value { get; }

    public PropertyCondition(AutomationProperty property, object value)
    {
        Property = property;
        Value = value;
    }

    internal override Com.IUIAutomationCondition ToCom()
    {
        // ControlType values travel as their integer id; everything else as-is (bool, string, int).
        object v = Value is ControlType ct ? ct.Id : Value;
        return UiaCore.Instance.CreatePropertyCondition(Property.Id, v);
    }
}

public sealed class AndCondition : Condition
{
    private readonly Condition[] _conditions;

    public AndCondition(params Condition[] conditions)
    {
        if (conditions.Length < 2)
            throw new ArgumentException("AndCondition requires at least two conditions", nameof(conditions));
        _conditions = conditions;
    }

    internal override Com.IUIAutomationCondition ToCom() =>
        UiaCore.Instance.CreateAndConditionFromArray(_conditions.Select(c => c.ToCom()).ToArray());
}

// ---- Elements --------------------------------------------------------------

public sealed class AutomationElement
{
    internal Com.IUIAutomationElement Com { get; }

    internal AutomationElement(Com.IUIAutomationElement element) { Com = element; }

    internal static AutomationElement? Wrap(Com.IUIAutomationElement? element) =>
        element == null ? null : new AutomationElement(element);

    // Property ids (UIA_*PropertyId) for use in PropertyCondition.
    public static readonly AutomationProperty BoundingRectangleProperty = new(30001, "AutomationElementIdentifiers.BoundingRectangleProperty");
    public static readonly AutomationProperty ProcessIdProperty = new(30002, "AutomationElementIdentifiers.ProcessIdProperty");
    public static readonly AutomationProperty ControlTypeProperty = new(30003, "AutomationElementIdentifiers.ControlTypeProperty");
    public static readonly AutomationProperty NameProperty = new(30005, "AutomationElementIdentifiers.NameProperty");
    public static readonly AutomationProperty HasKeyboardFocusProperty = new(30008, "AutomationElementIdentifiers.HasKeyboardFocusProperty");
    public static readonly AutomationProperty IsEnabledProperty = new(30010, "AutomationElementIdentifiers.IsEnabledProperty");
    public static readonly AutomationProperty AutomationIdProperty = new(30011, "AutomationElementIdentifiers.AutomationIdProperty");
    public static readonly AutomationProperty ClassNameProperty = new(30012, "AutomationElementIdentifiers.ClassNameProperty");
    public static readonly AutomationProperty NativeWindowHandleProperty = new(30020, "AutomationElementIdentifiers.NativeWindowHandleProperty");
    public static readonly AutomationProperty IsOffscreenProperty = new(30022, "AutomationElementIdentifiers.IsOffscreenProperty");

    public static AutomationElement RootElement =>
        UiaCore.Guard(() => new AutomationElement(UiaCore.Instance.GetRootElement()));

    public static AutomationElement FromHandle(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero) throw new ArgumentException("Window handle is null", nameof(hwnd));
        return UiaCore.Guard(() => new AutomationElement(UiaCore.Instance.ElementFromHandle(hwnd)));
    }

    public static AutomationElement? FocusedElement =>
        UiaCore.Guard(() => Wrap(UiaCore.Instance.GetFocusedElement()));

    public AutomationElementInformation Current => new(Com);

    public AutomationElement? FindFirst(TreeScope scope, Condition condition) =>
        UiaCore.Guard(() => Wrap(Com.FindFirst((Com.TreeScope)scope, condition.ToCom())));

    public AutomationElementCollection FindAll(TreeScope scope, Condition condition) =>
        UiaCore.Guard(() => new AutomationElementCollection(Com.FindAll((Com.TreeScope)scope, condition.ToCom())));

    public bool TryGetCurrentPattern(AutomationPattern pattern, out object patternObject)
    {
        patternObject = null!;
        object? raw;
        try { raw = Com.GetCurrentPattern(pattern.Id); }
        catch (COMException) { return false; }
        if (raw == null) return false;

        object? wrapped = pattern.Id switch
        {
            InvokePattern.PatternId => new InvokePattern((Com.IUIAutomationInvokePattern)raw),
            ValuePattern.PatternId => new ValuePattern((Com.IUIAutomationValuePattern)raw),
            TogglePattern.PatternId => new TogglePattern((Com.IUIAutomationTogglePattern)raw),
            ExpandCollapsePattern.PatternId => new ExpandCollapsePattern((Com.IUIAutomationExpandCollapsePattern)raw),
            SelectionItemPattern.PatternId => new SelectionItemPattern((Com.IUIAutomationSelectionItemPattern)raw),
            RangeValuePattern.PatternId => new RangeValuePattern((Com.IUIAutomationRangeValuePattern)raw),
            ScrollItemPattern.PatternId => new ScrollItemPattern((Com.IUIAutomationScrollItemPattern)raw),
            _ => null,
        };
        if (wrapped == null) return false;
        patternObject = wrapped;
        return true;
    }

    public object GetCurrentPattern(AutomationPattern pattern)
    {
        if (TryGetCurrentPattern(pattern, out var p)) return p;
        throw new InvalidOperationException($"Pattern {pattern.ProgrammaticName} is not supported by this element");
    }

    public void SetFocus() => UiaCore.Guard<object?>(() => { Com.SetFocus(); return null; });

    public object? GetCurrentPropertyValue(AutomationProperty property) =>
        UiaCore.Guard(() => Com.GetCurrentPropertyValue(property.Id));

    public int[] GetRuntimeId() => UiaCore.Guard(() => Com.GetRuntimeId() ?? Array.Empty<int>());

    public override bool Equals(object? obj)
    {
        if (obj is not AutomationElement other) return false;
        try { return UiaCore.Instance.CompareElements(Com, other.Com) != 0; }
        catch (COMException) { return false; }
    }

    public override int GetHashCode()
    {
        try
        {
            var id = Com.GetRuntimeId();
            if (id == null || id.Length == 0) return 0;
            var h = new HashCode();
            foreach (var i in id) h.Add(i);
            return h.ToHashCode();
        }
        catch (COMException) { return 0; }
    }
}

/// <summary>Live property reads, mirroring AutomationElement.Current from the managed client.</summary>
public sealed class AutomationElementInformation
{
    private readonly Com.IUIAutomationElement _e;
    internal AutomationElementInformation(Com.IUIAutomationElement e) { _e = e; }

    public string Name => UiaCore.Guard(() => _e.CurrentName ?? string.Empty);
    public ControlType ControlType => UiaCore.Guard(() => ControlType.LookupById(_e.CurrentControlType));
    public string LocalizedControlType => UiaCore.Guard(() => _e.CurrentLocalizedControlType ?? string.Empty);
    public bool IsEnabled => UiaCore.Guard(() => _e.CurrentIsEnabled != 0);
    public bool IsOffscreen => UiaCore.Guard(() => _e.CurrentIsOffscreen != 0);
    public bool HasKeyboardFocus => UiaCore.Guard(() => _e.CurrentHasKeyboardFocus != 0);
    public bool IsKeyboardFocusable => UiaCore.Guard(() => _e.CurrentIsKeyboardFocusable != 0);
    public bool IsControlElement => UiaCore.Guard(() => _e.CurrentIsControlElement != 0);
    public bool IsContentElement => UiaCore.Guard(() => _e.CurrentIsContentElement != 0);
    public string AutomationId => UiaCore.Guard(() => _e.CurrentAutomationId ?? string.Empty);
    public string ClassName => UiaCore.Guard(() => _e.CurrentClassName ?? string.Empty);
    public string HelpText => UiaCore.Guard(() => _e.CurrentHelpText ?? string.Empty);
    public string ItemType => UiaCore.Guard(() => _e.CurrentItemType ?? string.Empty);
    public string ItemStatus => UiaCore.Guard(() => _e.CurrentItemStatus ?? string.Empty);
    public string AcceleratorKey => UiaCore.Guard(() => _e.CurrentAcceleratorKey ?? string.Empty);
    public string AccessKey => UiaCore.Guard(() => _e.CurrentAccessKey ?? string.Empty);
    public string FrameworkId => UiaCore.Guard(() => _e.CurrentFrameworkId ?? string.Empty);
    public int ProcessId => UiaCore.Guard(() => _e.CurrentProcessId);
    public int NativeWindowHandle => UiaCore.Guard(() => (int)_e.CurrentNativeWindowHandle);

    public Rect BoundingRectangle => UiaCore.Guard(() =>
    {
        var r = _e.CurrentBoundingRectangle;
        int w = r.right - r.left, h = r.bottom - r.top;
        if (w <= 0 && h <= 0) return Rect.Empty;
        return new Rect(r.left, r.top, w, h);
    });
}

public sealed class AutomationElementCollection : IReadOnlyList<AutomationElement>
{
    private readonly Com.IUIAutomationElementArray? _array;

    internal AutomationElementCollection(Com.IUIAutomationElementArray? array) { _array = array; }

    public int Count => _array == null ? 0 : UiaCore.Guard(() => _array.Length);

    public AutomationElement this[int index]
    {
        get
        {
            if (_array == null || index < 0 || index >= Count) throw new ArgumentOutOfRangeException(nameof(index));
            return UiaCore.Guard(() => new AutomationElement(_array.GetElement(index)));
        }
    }

    public IEnumerator<AutomationElement> GetEnumerator()
    {
        int n = Count;
        for (int i = 0; i < n; i++) yield return this[i];
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

// ---- Tree walking ----------------------------------------------------------

public sealed class TreeWalker
{
    private readonly Com.IUIAutomationTreeWalker _walker;

    private TreeWalker(Com.IUIAutomationTreeWalker walker) { _walker = walker; }

    public static TreeWalker ControlViewWalker => new(UiaCore.Instance.ControlViewWalker);
    public static TreeWalker ContentViewWalker => new(UiaCore.Instance.ContentViewWalker);
    public static TreeWalker RawViewWalker => new(UiaCore.Instance.RawViewWalker);

    public AutomationElement? GetParent(AutomationElement e) =>
        UiaCore.Guard(() => AutomationElement.Wrap(_walker.GetParentElement(e.Com)));
    public AutomationElement? GetFirstChild(AutomationElement e) =>
        UiaCore.Guard(() => AutomationElement.Wrap(_walker.GetFirstChildElement(e.Com)));
    public AutomationElement? GetLastChild(AutomationElement e) =>
        UiaCore.Guard(() => AutomationElement.Wrap(_walker.GetLastChildElement(e.Com)));
    public AutomationElement? GetNextSibling(AutomationElement e) =>
        UiaCore.Guard(() => AutomationElement.Wrap(_walker.GetNextSiblingElement(e.Com)));
    public AutomationElement? GetPreviousSibling(AutomationElement e) =>
        UiaCore.Guard(() => AutomationElement.Wrap(_walker.GetPreviousSiblingElement(e.Com)));
}

// ---- Patterns --------------------------------------------------------------

public sealed class InvokePattern
{
    internal const int PatternId = 10000;
    public static readonly AutomationPattern Pattern = new(PatternId, "InvokePatternIdentifiers.Pattern");
    private readonly Com.IUIAutomationInvokePattern _p;
    internal InvokePattern(Com.IUIAutomationInvokePattern p) { _p = p; }
    public void Invoke() => UiaCore.Guard<object?>(() => { _p.Invoke(); return null; });
}

public sealed class ValuePattern
{
    internal const int PatternId = 10002;
    public static readonly AutomationPattern Pattern = new(PatternId, "ValuePatternIdentifiers.Pattern");
    private readonly Com.IUIAutomationValuePattern _p;
    internal ValuePattern(Com.IUIAutomationValuePattern p) { _p = p; }
    public void SetValue(string value) => UiaCore.Guard<object?>(() => { _p.SetValue(value); return null; });
    public ValuePatternInformation Current => new(_p);

    public sealed class ValuePatternInformation
    {
        private readonly Com.IUIAutomationValuePattern _p;
        internal ValuePatternInformation(Com.IUIAutomationValuePattern p) { _p = p; }
        public string Value => UiaCore.Guard(() => _p.CurrentValue ?? string.Empty);
        public bool IsReadOnly => UiaCore.Guard(() => _p.CurrentIsReadOnly != 0);
    }
}

public sealed class RangeValuePattern
{
    internal const int PatternId = 10003;
    public static readonly AutomationPattern Pattern = new(PatternId, "RangeValuePatternIdentifiers.Pattern");
    private readonly Com.IUIAutomationRangeValuePattern _p;
    internal RangeValuePattern(Com.IUIAutomationRangeValuePattern p) { _p = p; }
    public void SetValue(double value) => UiaCore.Guard<object?>(() => { _p.SetValue(value); return null; });
    public RangeValuePatternInformation Current => new(_p);

    public sealed class RangeValuePatternInformation
    {
        private readonly Com.IUIAutomationRangeValuePattern _p;
        internal RangeValuePatternInformation(Com.IUIAutomationRangeValuePattern p) { _p = p; }
        public double Value => UiaCore.Guard(() => _p.CurrentValue);
        public double Minimum => UiaCore.Guard(() => _p.CurrentMinimum);
        public double Maximum => UiaCore.Guard(() => _p.CurrentMaximum);
        public bool IsReadOnly => UiaCore.Guard(() => _p.CurrentIsReadOnly != 0);
    }
}

public sealed class ExpandCollapsePattern
{
    internal const int PatternId = 10005;
    public static readonly AutomationPattern Pattern = new(PatternId, "ExpandCollapsePatternIdentifiers.Pattern");
    private readonly Com.IUIAutomationExpandCollapsePattern _p;
    internal ExpandCollapsePattern(Com.IUIAutomationExpandCollapsePattern p) { _p = p; }
    public void Expand() => UiaCore.Guard<object?>(() => { _p.Expand(); return null; });
    public void Collapse() => UiaCore.Guard<object?>(() => { _p.Collapse(); return null; });
    public ExpandCollapsePatternInformation Current => new(_p);

    public sealed class ExpandCollapsePatternInformation
    {
        private readonly Com.IUIAutomationExpandCollapsePattern _p;
        internal ExpandCollapsePatternInformation(Com.IUIAutomationExpandCollapsePattern p) { _p = p; }
        public ExpandCollapseState ExpandCollapseState => UiaCore.Guard(() => (ExpandCollapseState)(int)_p.CurrentExpandCollapseState);
    }
}

public sealed class SelectionItemPattern
{
    internal const int PatternId = 10010;
    public static readonly AutomationPattern Pattern = new(PatternId, "SelectionItemPatternIdentifiers.Pattern");
    private readonly Com.IUIAutomationSelectionItemPattern _p;
    internal SelectionItemPattern(Com.IUIAutomationSelectionItemPattern p) { _p = p; }
    public void Select() => UiaCore.Guard<object?>(() => { _p.Select(); return null; });
    public void AddToSelection() => UiaCore.Guard<object?>(() => { _p.AddToSelection(); return null; });
    public void RemoveFromSelection() => UiaCore.Guard<object?>(() => { _p.RemoveFromSelection(); return null; });
    public SelectionItemPatternInformation Current => new(_p);

    public sealed class SelectionItemPatternInformation
    {
        private readonly Com.IUIAutomationSelectionItemPattern _p;
        internal SelectionItemPatternInformation(Com.IUIAutomationSelectionItemPattern p) { _p = p; }
        public bool IsSelected => UiaCore.Guard(() => _p.CurrentIsSelected != 0);
    }
}

public sealed class TogglePattern
{
    internal const int PatternId = 10015;
    public static readonly AutomationPattern Pattern = new(PatternId, "TogglePatternIdentifiers.Pattern");
    private readonly Com.IUIAutomationTogglePattern _p;
    internal TogglePattern(Com.IUIAutomationTogglePattern p) { _p = p; }
    public void Toggle() => UiaCore.Guard<object?>(() => { _p.Toggle(); return null; });
    public TogglePatternInformation Current => new(_p);

    public sealed class TogglePatternInformation
    {
        private readonly Com.IUIAutomationTogglePattern _p;
        internal TogglePatternInformation(Com.IUIAutomationTogglePattern p) { _p = p; }
        public ToggleState ToggleState => UiaCore.Guard(() => (ToggleState)(int)_p.CurrentToggleState);
    }
}

public sealed class ScrollItemPattern
{
    internal const int PatternId = 10017;
    public static readonly AutomationPattern Pattern = new(PatternId, "ScrollItemPatternIdentifiers.Pattern");
    private readonly Com.IUIAutomationScrollItemPattern _p;
    internal ScrollItemPattern(Com.IUIAutomationScrollItemPattern p) { _p = p; }
    public void ScrollIntoView() => UiaCore.Guard<object?>(() => { _p.ScrollIntoView(); return null; });
}

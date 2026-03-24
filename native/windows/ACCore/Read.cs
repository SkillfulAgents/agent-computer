using System.Windows.Automation;

namespace ACCore;

public class ReadHelper
{
    private readonly Dictionary<string, AutomationElement> _refMap;

    public ReadHelper(Dictionary<string, AutomationElement> refMap)
    {
        _refMap = refMap;
    }

    public object Read(string refStr, string? attr = null)
    {
        var element = ResolveElement(refStr);

        string? value = null;
        string? label = element.Current.Name;
        string role = Roles.NormalizeRole(element.Current.ControlType);

        if (attr != null)
        {
            value = GetAttribute(element, attr);
        }
        else
        {
            // Default: get value
            if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var valObj))
                value = ((ValuePattern)valObj).Current.Value;
            else if (element.TryGetCurrentPattern(RangeValuePattern.Pattern, out var rangeObj))
                value = ((RangeValuePattern)rangeObj).Current.Value.ToString();
            else if (element.TryGetCurrentPattern(TogglePattern.Pattern, out var toggleObj))
                value = ((TogglePattern)toggleObj).Current.ToggleState == ToggleState.On ? "1" : "0";
            else
                value = label; // Fallback to name
        }

        return new { @ref = refStr, role, label, value };
    }

    public object IsState(string state, string refStr)
    {
        var element = ResolveElement(refStr);

        bool result = state.ToLowerInvariant() switch
        {
            "visible" => !element.Current.BoundingRectangle.IsEmpty &&
                         !element.Current.IsOffscreen,
            "enabled" => element.Current.IsEnabled,
            "focused" => element.Current.HasKeyboardFocus,
            "checked" => IsChecked(element),
            _ => throw new ACException(ErrorCodes.InvalidParams, $"Unknown state: {state}")
        };

        return new { state, @ref = refStr, result };
    }

    public object Box(string refStr)
    {
        var element = ResolveElement(refStr);
        var rect = element.Current.BoundingRectangle;
        if (rect.IsEmpty)
            throw new ACException(ErrorCodes.ElementNotFound, $"Element has no bounds: {refStr}");

        return new
        {
            @ref = refStr,
            bounds = new int[] { (int)rect.X, (int)rect.Y, (int)rect.Width, (int)rect.Height },
        };
    }

    public object Children(string refStr)
    {
        var element = ResolveElement(refStr);
        var children = new List<object>();

        var walker = TreeWalker.ControlViewWalker;
        var child = walker.GetFirstChild(element);

        while (child != null)
        {
            try
            {
                string? val = null;
                if (child.TryGetCurrentPattern(ValuePattern.Pattern, out var valObj))
                    val = ((ValuePattern)valObj).Current.Value;

                children.Add(new
                {
                    role = Roles.NormalizeRole(child.Current.ControlType),
                    label = child.Current.Name,
                    value = val,
                    enabled = child.Current.IsEnabled,
                });
            }
            catch { }

            try { child = walker.GetNextSibling(child); } catch { break; }
        }

        return new { @ref = refStr, children };
    }

    public object Title(bool appMode, string? grabbedWindow, WindowManager windowManager)
    {
        if (appMode)
        {
            // Return the active app name
            var windows = windowManager.ListWindows();
            var frontWindow = windows.FirstOrDefault(w => !w.Minimized && !w.Hidden);
            return new { title = frontWindow?.App ?? "" };
        }

        if (grabbedWindow != null)
        {
            var info = windowManager.GetWindowInfo(grabbedWindow);
            return new { title = info?.Title ?? "" };
        }

        return new { title = "" };
    }

    private string? GetAttribute(AutomationElement element, string attr)
    {
        return attr.ToLowerInvariant() switch
        {
            "name" or "label" => element.Current.Name,
            "value" => GetValue(element),
            "role" or "controltype" => element.Current.ControlType.ProgrammaticName,
            "enabled" => element.Current.IsEnabled.ToString(),
            "focused" => element.Current.HasKeyboardFocus.ToString(),
            "automationid" => element.Current.AutomationId,
            "classname" => element.Current.ClassName,
            "helptext" => element.Current.HelpText,
            "itemtype" => element.Current.ItemType,
            "itemstatus" => element.Current.ItemStatus,
            "acceleratorkey" => element.Current.AcceleratorKey,
            "accesskey" => element.Current.AccessKey,
            _ => null,
        };
    }

    private string? GetValue(AutomationElement element)
    {
        if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var valObj))
            return ((ValuePattern)valObj).Current.Value;
        if (element.TryGetCurrentPattern(RangeValuePattern.Pattern, out var rangeObj))
            return ((RangeValuePattern)rangeObj).Current.Value.ToString();
        return null;
    }

    private bool IsChecked(AutomationElement element)
    {
        if (element.TryGetCurrentPattern(TogglePattern.Pattern, out var toggleObj))
            return ((TogglePattern)toggleObj).Current.ToggleState == ToggleState.On;
        if (element.TryGetCurrentPattern(SelectionItemPattern.Pattern, out var selObj))
            return ((SelectionItemPattern)selObj).Current.IsSelected;
        return false;
    }

    private AutomationElement ResolveElement(string refStr)
    {
        if (_refMap.TryGetValue(refStr, out var element))
            return element;
        throw new ACException(ErrorCodes.ElementNotFound, $"Element not found: {refStr}",
            new { available_refs = _refMap.Keys.Take(20).ToArray() });
    }
}

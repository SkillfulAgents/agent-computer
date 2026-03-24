using System.Windows.Automation;

namespace ACCore;

public class DialogManager
{
    public object DetectDialog(AutomationElement windowElement)
    {
        // Search for modal windows/dialogs
        var dialog = FindDialog(windowElement);
        if (dialog == null)
            return new { found = false };

        var type = ClassifyDialog(dialog);
        var message = ExtractMessage(dialog);
        var buttons = ExtractButtons(dialog);
        var elements = ExtractElements(dialog);

        return new
        {
            found = true,
            type,
            message,
            buttons,
            elements,
        };
    }

    public object AcceptDialog(AutomationElement windowElement, string? buttonText = null)
    {
        var dialog = FindDialog(windowElement)
            ?? throw new ACException(ErrorCodes.ElementNotFound, "No dialog found");

        AutomationElement? button = null;

        if (buttonText != null)
        {
            button = FindButton(dialog, buttonText);
        }
        else
        {
            // Try common accept buttons
            string[] acceptLabels = ["OK", "Yes", "Save", "Done", "Open", "Allow", "Continue", "Replace", "Delete", "Confirm", "Accept"];
            foreach (var label in acceptLabels)
            {
                button = FindButton(dialog, label);
                if (button != null) break;
            }
        }

        if (button == null)
            throw new ACException(ErrorCodes.ElementNotFound, "No accept button found in dialog");

        if (button.TryGetCurrentPattern(InvokePattern.Pattern, out var invokeObj))
        {
            ((InvokePattern)invokeObj).Invoke();
            return new { ok = true };
        }

        throw new ACException(ErrorCodes.InvalidParams, "Button does not support invoke");
    }

    public object DismissDialog(AutomationElement windowElement)
    {
        var dialog = FindDialog(windowElement)
            ?? throw new ACException(ErrorCodes.ElementNotFound, "No dialog found");

        // Try common dismiss buttons
        string[] dismissLabels = ["Cancel", "No", "Close", "Dismiss", "Don't Save"];
        AutomationElement? button = null;
        foreach (var label in dismissLabels)
        {
            button = FindButton(dialog, label);
            if (button != null) break;
        }

        if (button != null && button.TryGetCurrentPattern(InvokePattern.Pattern, out var invokeObj))
        {
            ((InvokePattern)invokeObj).Invoke();
            return new { ok = true };
        }

        // Fallback: press Escape
        Actions.VirtualKeyFromName("escape"); // validate the key name
        // Actually send the key
        var actions = new Actions(new Dictionary<string, AutomationElement>());
        actions.PressKey("escape");
        return new { ok = true };
    }

    private AutomationElement? FindDialog(AutomationElement windowElement)
    {
        // Look for dialog windows
        try
        {
            // Try finding a Window child that's a dialog
            var dialog = windowElement.FindFirst(TreeScope.Children,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Window));
            if (dialog != null) return dialog;

            // Try finding a Pane that acts as dialog
            dialog = windowElement.FindFirst(TreeScope.Children,
                new AndCondition(
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Pane),
                    new PropertyCondition(AutomationElement.IsEnabledProperty, true)
                ));
            if (dialog != null && HasButtons(dialog)) return dialog;
        }
        catch { }

        return null;
    }

    private string ClassifyDialog(AutomationElement dialog)
    {
        var name = dialog.Current.Name.ToLowerInvariant();
        if (name.Contains("open")) return "file-open";
        if (name.Contains("save")) return "file-save";
        if (name.Contains("alert") || name.Contains("warning") || name.Contains("error"))
            return "alert";
        return "custom";
    }

    private string ExtractMessage(AutomationElement dialog)
    {
        var texts = new List<string>();
        var walker = TreeWalker.ControlViewWalker;
        CollectText(walker, dialog, texts, 3);
        return string.Join(" ", texts);
    }

    private void CollectText(TreeWalker walker, AutomationElement element, List<string> texts, int maxDepth, int depth = 0)
    {
        if (depth > maxDepth) return;

        var child = walker.GetFirstChild(element);
        while (child != null)
        {
            try
            {
                if (child.Current.ControlType == ControlType.Text)
                {
                    var name = child.Current.Name;
                    if (!string.IsNullOrWhiteSpace(name))
                        texts.Add(name);
                }
                CollectText(walker, child, texts, maxDepth, depth + 1);
            }
            catch { }
            try { child = walker.GetNextSibling(child); } catch { break; }
        }
    }

    private string[] ExtractButtons(AutomationElement dialog)
    {
        var buttons = new List<string>();
        try
        {
            var buttonElements = dialog.FindAll(TreeScope.Descendants,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button));
            foreach (AutomationElement btn in buttonElements)
            {
                var name = btn.Current.Name;
                if (!string.IsNullOrWhiteSpace(name))
                    buttons.Add(name);
            }
        }
        catch { }
        return buttons.ToArray();
    }

    private object[] ExtractElements(AutomationElement dialog)
    {
        var elements = new List<object>();
        try
        {
            var allElements = dialog.FindAll(TreeScope.Children, Condition.TrueCondition);
            foreach (AutomationElement el in allElements)
            {
                elements.Add(new
                {
                    role = Roles.NormalizeRole(el.Current.ControlType),
                    label = el.Current.Name,
                    enabled = el.Current.IsEnabled,
                });
            }
        }
        catch { }
        return elements.ToArray();
    }

    private bool HasButtons(AutomationElement element)
    {
        try
        {
            var buttons = element.FindAll(TreeScope.Descendants,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button));
            return buttons.Count > 0;
        }
        catch { return false; }
    }

    private AutomationElement? FindButton(AutomationElement dialog, string name)
    {
        try
        {
            var buttons = dialog.FindAll(TreeScope.Descendants,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button));
            foreach (AutomationElement btn in buttons)
            {
                if (btn.Current.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
                    return btn;
            }
        }
        catch { }
        return null;
    }
}

using System.Windows.Automation;

namespace ACCore;

public class MenuManager
{
    public object NavigateMenu(AutomationElement appElement, string path)
    {
        var parts = path.Split('>').Select(p => p.Trim()).Where(p => p.Length > 0).ToArray();
        if (parts.Length == 0)
            throw new ACException(ErrorCodes.InvalidParams, "Menu path is empty");

        // Find the menu bar
        var menuBar = FindMenuBar(appElement)
            ?? throw new ACException(ErrorCodes.ElementNotFound, "Menu bar not found");

        AutomationElement current = menuBar;

        for (int i = 0; i < parts.Length; i++)
        {
            var menuItem = FindMenuItem(current, parts[i])
                ?? throw new ACException(ErrorCodes.ElementNotFound,
                    $"Menu item not found: {parts[i]} in path: {path}");

            if (i < parts.Length - 1)
            {
                // Open submenu
                if (menuItem.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out var expandObj))
                {
                    ((ExpandCollapsePattern)expandObj).Expand();
                    Thread.Sleep(150);
                }
                else if (menuItem.TryGetCurrentPattern(InvokePattern.Pattern, out var invokeObj))
                {
                    ((InvokePattern)invokeObj).Invoke();
                    Thread.Sleep(150);
                }
                current = menuItem;
            }
            else
            {
                // Click final item
                if (menuItem.TryGetCurrentPattern(InvokePattern.Pattern, out var invokeObj))
                    ((InvokePattern)invokeObj).Invoke();
                else if (menuItem.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out var expandObj))
                    ((ExpandCollapsePattern)expandObj).Expand();
            }
        }

        return new { ok = true };
    }

    public object ListMenus(AutomationElement appElement, string? menuName = null)
    {
        var menuBar = FindMenuBar(appElement);
        if (menuBar == null)
            return new { menus = Array.Empty<object>() };

        var menus = new List<object>();
        var walker = TreeWalker.ControlViewWalker;
        var child = walker.GetFirstChild(menuBar);

        while (child != null)
        {
            var name = child.Current.Name;
            if (menuName != null && !name.Equals(menuName, StringComparison.OrdinalIgnoreCase))
            {
                child = walker.GetNextSibling(child);
                continue;
            }

            var items = new List<object>();

            // Try expanding to get children
            if (child.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out var expandObj))
            {
                var expand = (ExpandCollapsePattern)expandObj;
                expand.Expand();
                Thread.Sleep(150);

                var subChild = walker.GetFirstChild(child);
                while (subChild != null)
                {
                    items.Add(new
                    {
                        name = subChild.Current.Name,
                        role = subChild.Current.ControlType.ProgrammaticName,
                        enabled = subChild.Current.IsEnabled,
                    });
                    subChild = walker.GetNextSibling(subChild);
                }

                expand.Collapse();
            }

            menus.Add(new { name, items });

            if (menuName != null) break;
            child = walker.GetNextSibling(child);
        }

        return new { menus };
    }

    private AutomationElement? FindMenuBar(AutomationElement appElement)
    {
        try
        {
            return appElement.FindFirst(TreeScope.Descendants,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.MenuBar));
        }
        catch
        {
            return null;
        }
    }

    private AutomationElement? FindMenuItem(AutomationElement parent, string name)
    {
        var walker = TreeWalker.ControlViewWalker;
        var child = walker.GetFirstChild(parent);

        while (child != null)
        {
            if (child.Current.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
                return child;
            child = walker.GetNextSibling(child);
        }

        return null;
    }
}

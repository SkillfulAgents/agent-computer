using ACCore.Uia;

namespace ACCore;

public class MenuManager
{
    // How long an expanded menu gets to materialise its popup before we read it.
    private const int ExpandSettleMs = 150;

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
            var entries = i == 0 ? DirectChildren(menuBar) : GetMenuEntries(appElement, current);
            var menuItem = entries.FirstOrDefault(e => NameEquals(e, parts[i]))
                ?? throw new ACException(ErrorCodes.ElementNotFound,
                    $"Menu item not found: {parts[i]} in path: {path}");

            if (i < parts.Length - 1)
            {
                // Open submenu
                if (menuItem.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out var expandObj))
                {
                    ((ExpandCollapsePattern)expandObj).Expand();
                    Thread.Sleep(ExpandSettleMs);
                }
                else if (menuItem.TryGetCurrentPattern(InvokePattern.Pattern, out var invokeObj))
                {
                    ((InvokePattern)invokeObj).Invoke();
                    Thread.Sleep(ExpandSettleMs);
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
                else
                    throw new ACException(ErrorCodes.InvalidParams, $"Menu item cannot be activated: {parts[i]}");
            }
        }

        return new { ok = true, path };
    }

    /// <summary>
    /// Same result shape as the macOS daemon so the CLI/SDK render both alike:
    ///   no menu   -> { ok, items: [{ title }] }               (top-level menus)
    ///   menu name -> { ok, menu, items: [{ title, enabled, children? }] }
    /// `all` walks submenus up to 5 levels deep instead of 1.
    /// </summary>
    public object ListMenus(AutomationElement appElement, string? menuName = null, bool all = false)
    {
        var menuBar = FindMenuBar(appElement);
        if (menuBar == null)
            return new { ok = true, items = Array.Empty<object>() };

        if (menuName == null)
        {
            var topLevel = DirectChildren(menuBar)
                .Select(e => e.Current.Name)
                .Where(t => !string.IsNullOrEmpty(t))
                .Select(t => (object)new { title = t })
                .ToList();
            return new { ok = true, items = topLevel };
        }

        var menu = DirectChildren(menuBar).FirstOrDefault(e => NameEquals(e, menuName))
            ?? throw new ACException(ErrorCodes.ElementNotFound, $"Menu not found: {menuName}");

        var items = new List<object>();
        if (menu.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out var expandObj))
        {
            var expand = (ExpandCollapsePattern)expandObj;
            expand.Expand();
            Thread.Sleep(ExpandSettleMs);
            try { items = WalkMenu(appElement, menu, 0, all ? 5 : 1); }
            finally { try { expand.Collapse(); } catch { } }
        }
        else if (menu.TryGetCurrentPattern(InvokePattern.Pattern, out var invokeObj))
        {
            // Some frameworks open top-level menus with Invoke rather than Expand.
            ((InvokePattern)invokeObj).Invoke();
            Thread.Sleep(ExpandSettleMs);
            try { items = WalkMenu(appElement, menu, 0, all ? 5 : 1); }
            finally { try { new Actions(new Dictionary<string, AutomationElement>()).PressKey("escape"); } catch { } }
        }

        return new { ok = true, menu = menuName, items };
    }

    private List<object> WalkMenu(AutomationElement appElement, AutomationElement menuItem, int depth, int maxDepth)
    {
        var results = new List<object>();
        foreach (var entry in GetMenuEntries(appElement, menuItem))
        {
            try
            {
                var title = entry.Current.Name;
                if (string.IsNullOrEmpty(title)) continue;
                var enabled = entry.Current.IsEnabled;

                List<object>? children = null;
                if (depth < maxDepth && entry.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out var subExpandObj))
                {
                    // Submenus only expose entries once expanded; peek without leaving them open.
                    var subExpand = (ExpandCollapsePattern)subExpandObj;
                    try
                    {
                        subExpand.Expand();
                        Thread.Sleep(ExpandSettleMs);
                        var sub = WalkMenu(appElement, entry, depth + 1, maxDepth);
                        if (sub.Count > 0) children = sub;
                    }
                    finally { try { subExpand.Collapse(); } catch { } }
                }

                if (children != null)
                    results.Add(new { title, enabled, children });
                else
                    results.Add(new { title, enabled });
            }
            catch { }
        }
        return results;
    }

    /// <summary>
    /// The entries of an expanded menu item. Three places to look, in order:
    ///  1. UIA children of the item itself (classic Win32 menus, most toolkits),
    ///     descending through an intermediate Menu container if present.
    ///  2. A Menu element elsewhere under the app window. WinUI/XAML apps
    ///     (Windows 11 Notepad, Terminal, ...) render open menus in a separate
    ///     "PopupHost" pane that is a sibling of the content, not a child of
    ///     the menu item.
    ///  3. A top-level Menu window owned by the same process (Win32 popup
    ///     menus, class #32768, which UIA parents to the desktop).
    /// </summary>
    private static List<AutomationElement> GetMenuEntries(AutomationElement appElement, AutomationElement menuItem)
    {
        var direct = MenuItemsUnder(menuItem, 2);
        if (direct.Count > 0) return direct;

        int pid;
        try { pid = menuItem.Current.ProcessId; } catch { pid = 0; }

        // 2. Popup hosted somewhere under the app window. Newest popup first:
        //    stale PopupHost panes from earlier menus linger but are empty.
        //    The popup that contains `menuItem` itself is its parent menu, not
        //    its submenu, so it never qualifies.
        try
        {
            var menus = appElement.FindAll(TreeScope.Descendants,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Menu));
            for (int i = menus.Count - 1; i >= 0; i--)
            {
                var found = MenuItemsUnder(menus[i], 1);
                if (found.Count > 0 && !Contains(found, menuItem)) return found;
            }
        }
        catch { }

        // 3. Win32 popup menu window at the desktop root.
        if (pid != 0)
        {
            try
            {
                var popups = AutomationElement.RootElement.FindAll(TreeScope.Children,
                    new AndCondition(
                        new PropertyCondition(AutomationElement.ProcessIdProperty, pid),
                        new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Menu)));
                for (int i = popups.Count - 1; i >= 0; i--)
                {
                    var found = MenuItemsUnder(popups[i], 1);
                    if (found.Count > 0 && !Contains(found, menuItem)) return found;
                }
            }
            catch { }
        }

        return direct;
    }

    private static bool Contains(List<AutomationElement> items, AutomationElement element)
    {
        foreach (var item in items)
        {
            try { if (item.Equals(element)) return true; }
            catch { }
        }
        return false;
    }

    /// <summary>MenuItem children of <paramref name="parent"/>, looking through up to <paramref name="containerDepth"/> levels of Menu/Group/Pane containers.</summary>
    private static List<AutomationElement> MenuItemsUnder(AutomationElement parent, int containerDepth)
    {
        var result = new List<AutomationElement>();
        foreach (var child in DirectChildren(parent))
        {
            ControlType ct;
            try { ct = child.Current.ControlType; } catch { continue; }
            if (ct == ControlType.MenuItem)
                result.Add(child);
            else if (containerDepth > 0 && (ct == ControlType.Menu || ct == ControlType.Group || ct == ControlType.Pane || ct == ControlType.List))
                result.AddRange(MenuItemsUnder(child, containerDepth - 1));
        }
        return result;
    }

    private static List<AutomationElement> DirectChildren(AutomationElement parent)
    {
        var list = new List<AutomationElement>();
        var walker = TreeWalker.ControlViewWalker;
        AutomationElement? child;
        try { child = walker.GetFirstChild(parent); } catch { return list; }
        while (child != null)
        {
            list.Add(child);
            try { child = walker.GetNextSibling(child); } catch { break; }
        }
        return list;
    }

    private static bool NameEquals(AutomationElement e, string name)
    {
        try { return e.Current.Name.Equals(name, StringComparison.OrdinalIgnoreCase); }
        catch { return false; }
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
}

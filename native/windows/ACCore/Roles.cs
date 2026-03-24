using System.Windows.Automation;

namespace ACCore;

/// <summary>
/// Maps Windows UI Automation ControlTypes to normalized role names matching the cross-platform spec.
/// Also provides ref prefix assignment for each role.
/// </summary>
public static class Roles
{
    // UIA ControlType → normalized role name
    private static readonly Dictionary<int, string> _controlTypeToRole = new()
    {
        { ControlType.Button.Id, "button" },
        { ControlType.Edit.Id, "textfield" },
        { ControlType.Text.Id, "text" },
        { ControlType.Hyperlink.Id, "link" },
        { ControlType.CheckBox.Id, "checkbox" },
        { ControlType.RadioButton.Id, "radio" },
        { ControlType.Slider.Id, "slider" },
        { ControlType.ComboBox.Id, "combobox" },
        { ControlType.Image.Id, "image" },
        { ControlType.Group.Id, "group" },
        { ControlType.Window.Id, "window" },
        { ControlType.Table.Id, "table" },
        { ControlType.DataGrid.Id, "table" },
        { ControlType.DataItem.Id, "row" },
        { ControlType.Tab.Id, "tabgroup" },
        { ControlType.TabItem.Id, "tab" },
        { ControlType.MenuBar.Id, "menubar" },
        { ControlType.MenuItem.Id, "menuitem" },
        { ControlType.Menu.Id, "menubar" },
        { ControlType.ScrollBar.Id, "scrollarea" },
        { ControlType.ToolBar.Id, "toolbar" },
        { ControlType.Tree.Id, "treeview" },
        { ControlType.TreeItem.Id, "row" },
        { ControlType.List.Id, "group" },
        { ControlType.ListItem.Id, "row" },
        { ControlType.ProgressBar.Id, "progress" },
        { ControlType.Spinner.Id, "stepper" },
        { ControlType.SplitButton.Id, "button" },
        { ControlType.StatusBar.Id, "toolbar" },
        { ControlType.Header.Id, "group" },
        { ControlType.HeaderItem.Id, "text" },
        { ControlType.Document.Id, "textarea" },
        { ControlType.Pane.Id, "group" },
        { ControlType.TitleBar.Id, "toolbar" },
        { ControlType.Thumb.Id, "slider" },
        { ControlType.ToolTip.Id, "text" },
        { ControlType.Calendar.Id, "group" },
        { ControlType.Custom.Id, "generic" },
    };

    // Normalized role → ref prefix
    private static readonly Dictionary<string, string> _roleToPrefix = new()
    {
        { "button", "b" },
        { "textfield", "t" },
        { "textarea", "t" },
        { "link", "l" },
        { "checkbox", "c" },
        { "radio", "r" },
        { "slider", "s" },
        { "dropdown", "d" },
        { "image", "i" },
        { "group", "g" },
        { "window", "w" },
        { "table", "x" },
        { "row", "o" },
        { "cell", "o" },
        { "tabgroup", "g" },
        { "tab", "a" },
        { "menubar", "m" },
        { "menuitem", "m" },
        { "scrollarea", "sa" },
        { "text", "t" },
        { "toolbar", "g" },
        { "combobox", "cb" },
        { "stepper", "st" },
        { "splitgroup", "sp" },
        { "timeline", "tl" },
        { "progress", "pg" },
        { "treeview", "tv" },
        { "webarea", "wb" },
        { "generic", "e" },
    };

    // Interactive roles — elements of these roles are shown in interactive-only mode
    private static readonly HashSet<string> _interactiveRoles = new()
    {
        "button", "textfield", "textarea", "link", "checkbox", "radio",
        "slider", "dropdown", "combobox", "tab", "menuitem", "stepper",
    };

    public static string NormalizeRole(ControlType controlType)
    {
        if (_controlTypeToRole.TryGetValue(controlType.Id, out var role))
            return role;
        return "generic";
    }

    public static string PrefixForRole(string normalizedRole)
    {
        if (_roleToPrefix.TryGetValue(normalizedRole, out var prefix))
            return prefix;
        return "e";
    }

    public static bool IsInteractive(string normalizedRole) =>
        _interactiveRoles.Contains(normalizedRole);
}

/// <summary>
/// Assigns unique refs to elements within a snapshot.
/// Each role prefix gets its own counter, reset per snapshot.
/// </summary>
public class RefAssigner
{
    private readonly Dictionary<string, int> _counters = new();

    public string Assign(string normalizedRole)
    {
        var prefix = Roles.PrefixForRole(normalizedRole);
        if (!_counters.TryGetValue(prefix, out var count))
            count = 0;
        count++;
        _counters[prefix] = count;
        return $"@{prefix}{count}";
    }

    public void Reset()
    {
        _counters.Clear();
    }
}

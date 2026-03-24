using System.Windows.Automation;
using ACCore;

namespace ACCore.Tests;

public class RolesTests
{
    // ---- NormalizeRole ----

    [Theory]
    [MemberData(nameof(ControlTypeMappings))]
    public void NormalizeRole_MapsControlTypesCorrectly(ControlType controlType, string expectedRole)
    {
        Assert.Equal(expectedRole, Roles.NormalizeRole(controlType));
    }

    public static TheoryData<ControlType, string> ControlTypeMappings => new()
    {
        { ControlType.Button, "button" },
        { ControlType.Edit, "textfield" },
        { ControlType.Text, "text" },
        { ControlType.Hyperlink, "link" },
        { ControlType.CheckBox, "checkbox" },
        { ControlType.RadioButton, "radio" },
        { ControlType.Slider, "slider" },
        { ControlType.ComboBox, "combobox" },
        { ControlType.Image, "image" },
        { ControlType.Group, "group" },
        { ControlType.Window, "window" },
        { ControlType.Table, "table" },
        { ControlType.DataGrid, "table" },
        { ControlType.DataItem, "row" },
        { ControlType.Tab, "tabgroup" },
        { ControlType.TabItem, "tab" },
        { ControlType.MenuBar, "menubar" },
        { ControlType.MenuItem, "menuitem" },
        { ControlType.Menu, "menubar" },
        { ControlType.ScrollBar, "scrollarea" },
        { ControlType.ToolBar, "toolbar" },
        { ControlType.Tree, "treeview" },
        { ControlType.TreeItem, "row" },
        { ControlType.List, "group" },
        { ControlType.ListItem, "row" },
        { ControlType.ProgressBar, "progress" },
        { ControlType.Spinner, "stepper" },
        { ControlType.SplitButton, "button" },
        { ControlType.StatusBar, "toolbar" },
        { ControlType.Header, "group" },
        { ControlType.HeaderItem, "text" },
        { ControlType.Document, "textarea" },
        { ControlType.Pane, "group" },
        { ControlType.TitleBar, "toolbar" },
        { ControlType.Thumb, "slider" },
        { ControlType.ToolTip, "text" },
        { ControlType.Calendar, "group" },
        { ControlType.Custom, "generic" },
    };

    [Fact]
    public void NormalizeRole_UnknownControlType_ReturnsGeneric()
    {
        // Separator is not in the mapping
        Assert.Equal("generic", Roles.NormalizeRole(ControlType.Separator));
    }

    // ---- PrefixForRole ----

    [Theory]
    [InlineData("button", "b")]
    [InlineData("textfield", "t")]
    [InlineData("textarea", "t")]
    [InlineData("link", "l")]
    [InlineData("checkbox", "c")]
    [InlineData("radio", "r")]
    [InlineData("slider", "s")]
    [InlineData("dropdown", "d")]
    [InlineData("image", "i")]
    [InlineData("group", "g")]
    [InlineData("window", "w")]
    [InlineData("table", "x")]
    [InlineData("row", "o")]
    [InlineData("cell", "o")]
    [InlineData("tabgroup", "g")]
    [InlineData("tab", "a")]
    [InlineData("menubar", "m")]
    [InlineData("menuitem", "m")]
    [InlineData("scrollarea", "sa")]
    [InlineData("text", "t")]
    [InlineData("toolbar", "g")]
    [InlineData("combobox", "cb")]
    [InlineData("stepper", "st")]
    [InlineData("splitgroup", "sp")]
    [InlineData("timeline", "tl")]
    [InlineData("progress", "pg")]
    [InlineData("treeview", "tv")]
    [InlineData("webarea", "wb")]
    [InlineData("generic", "e")]
    public void PrefixForRole_MapsCorrectly(string role, string expectedPrefix)
    {
        Assert.Equal(expectedPrefix, Roles.PrefixForRole(role));
    }

    [Fact]
    public void PrefixForRole_UnknownRole_ReturnsE()
    {
        Assert.Equal("e", Roles.PrefixForRole("nonexistent_role"));
    }

    // ---- IsInteractive ----

    [Theory]
    [InlineData("button")]
    [InlineData("textfield")]
    [InlineData("textarea")]
    [InlineData("link")]
    [InlineData("checkbox")]
    [InlineData("radio")]
    [InlineData("slider")]
    [InlineData("dropdown")]
    [InlineData("combobox")]
    [InlineData("tab")]
    [InlineData("menuitem")]
    [InlineData("stepper")]
    public void IsInteractive_ReturnsTrueForInteractiveRoles(string role)
    {
        Assert.True(Roles.IsInteractive(role));
    }

    [Theory]
    [InlineData("text")]
    [InlineData("image")]
    [InlineData("group")]
    [InlineData("window")]
    [InlineData("table")]
    [InlineData("row")]
    [InlineData("toolbar")]
    [InlineData("menubar")]
    [InlineData("scrollarea")]
    [InlineData("generic")]
    [InlineData("progress")]
    [InlineData("treeview")]
    [InlineData("tabgroup")]
    public void IsInteractive_ReturnsFalseForNonInteractiveRoles(string role)
    {
        Assert.False(Roles.IsInteractive(role));
    }

    [Fact]
    public void IsInteractive_UnknownRole_ReturnsFalse()
    {
        Assert.False(Roles.IsInteractive("nonexistent_role"));
    }

    // ---- RefAssigner ----

    [Fact]
    public void RefAssigner_AssignsSequentialRefs()
    {
        var assigner = new RefAssigner();

        Assert.Equal("@b1", assigner.Assign("button"));
        Assert.Equal("@b2", assigner.Assign("button"));
        Assert.Equal("@b3", assigner.Assign("button"));
    }

    [Fact]
    public void RefAssigner_DifferentRoles_GetIndependentCounters()
    {
        var assigner = new RefAssigner();

        Assert.Equal("@b1", assigner.Assign("button"));
        Assert.Equal("@t1", assigner.Assign("textfield"));
        Assert.Equal("@l1", assigner.Assign("link"));
        Assert.Equal("@b2", assigner.Assign("button"));
        Assert.Equal("@t2", assigner.Assign("textfield"));
    }

    [Fact]
    public void RefAssigner_SamePrefix_SharedCounter()
    {
        // textfield and textarea both map to prefix "t"
        var assigner = new RefAssigner();

        Assert.Equal("@t1", assigner.Assign("textfield"));
        Assert.Equal("@t2", assigner.Assign("textarea"));
        Assert.Equal("@t3", assigner.Assign("text"));
    }

    [Fact]
    public void RefAssigner_Reset_ClearsAllCounters()
    {
        var assigner = new RefAssigner();

        assigner.Assign("button");
        assigner.Assign("button");
        assigner.Assign("link");

        assigner.Reset();

        Assert.Equal("@b1", assigner.Assign("button"));
        Assert.Equal("@l1", assigner.Assign("link"));
    }

    [Fact]
    public void RefAssigner_UnknownRole_UsesGenericPrefix()
    {
        var assigner = new RefAssigner();

        Assert.Equal("@e1", assigner.Assign("unknown_role"));
        Assert.Equal("@e2", assigner.Assign("another_unknown"));
    }

    [Fact]
    public void RefAssigner_ManyAssignments_CountersGrowCorrectly()
    {
        var assigner = new RefAssigner();

        for (int i = 1; i <= 100; i++)
        {
            var expected = $"@b{i}";
            Assert.Equal(expected, assigner.Assign("button"));
        }
    }

    [Fact]
    public void RefAssigner_ComplexScenario_MaintainsState()
    {
        var assigner = new RefAssigner();

        // Simulate a realistic snapshot assignment
        Assert.Equal("@g1", assigner.Assign("group"));      // window group
        Assert.Equal("@g2", assigner.Assign("toolbar"));     // toolbar -> "g" prefix
        Assert.Equal("@b1", assigner.Assign("button"));      // close btn
        Assert.Equal("@b2", assigner.Assign("button"));      // minimize btn
        Assert.Equal("@t1", assigner.Assign("textfield"));   // search field
        Assert.Equal("@t2", assigner.Assign("text"));        // label (also "t" prefix)
        Assert.Equal("@l1", assigner.Assign("link"));        // hyperlink
        Assert.Equal("@c1", assigner.Assign("checkbox"));    // checkbox
        Assert.Equal("@cb1", assigner.Assign("combobox"));   // combobox
        Assert.Equal("@m1", assigner.Assign("menuitem"));    // menu item
    }
}

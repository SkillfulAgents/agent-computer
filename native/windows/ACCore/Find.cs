namespace ACCore;

public class FindHelper
{
    public object Find(List<ElementInfo> elements, string? text, string? role, bool firstOnly)
    {
        var results = new List<object>();
        SearchTree(elements, text, role, results, firstOnly);

        return new
        {
            elements = results,
            count = results.Count,
        };
    }

    private void SearchTree(List<ElementInfo> elements, string? text, string? role, List<object> results, bool firstOnly)
    {
        foreach (var el in elements)
        {
            if (firstOnly && results.Count > 0) return;

            bool textMatch = text == null || MatchesText(el, text);
            bool roleMatch = role == null || el.Role.Equals(role, StringComparison.OrdinalIgnoreCase);

            if (textMatch && roleMatch)
            {
                results.Add(new
                {
                    @ref = el.Ref,
                    role = el.Role,
                    label = el.Label,
                    value = el.Value,
                    enabled = el.Enabled,
                    bounds = el.Bounds,
                });
            }

            if (el.Children != null)
                SearchTree(el.Children, text, role, results, firstOnly);
        }
    }

    /// <summary>
    /// Checks if an element's label or value contains the given text (case-insensitive substring).
    /// Note: An empty string text will match all elements that have a non-null label or value,
    /// because string.Contains("") returns true. This is intentional — an empty text filter
    /// effectively matches any element with text content.
    /// </summary>
    private bool MatchesText(ElementInfo el, string text)
    {
        return (el.Label != null && el.Label.Contains(text, StringComparison.OrdinalIgnoreCase))
            || (el.Value != null && el.Value.Contains(text, StringComparison.OrdinalIgnoreCase));
    }
}

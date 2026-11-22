
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  FolderTree,
  Folder,
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  Power,
} from "lucide-react";
import {
  deleteCategories,
  saveCategory as createCategory,
  updateCategory,
  useSupabaseCatalogue,
} from "../../data/supabaseCatalogue";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  active: boolean;
  createdAt: string;
}

export default function CategoryManagement() {
  const { categories, loading, error: catalogueError } = useSupabaseCatalogue(true);
  const [categoryName, setCategoryName] = useState("");
  const [parentId, setParentId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const childrenOf = (id: string) =>
    categories.filter((category) => category.parentId === id);

  const getDescendantIds = (id: string): string[] => {
    const descendants: string[] = [];

    const visit = (parent: string) => {
      childrenOf(parent).forEach((child) => {
        descendants.push(child.id);
        visit(child.id);
      });
    };

    visit(id);
    return descendants;
  };

  const getPath = (id: string): string => {
    const category = categories.find((item) => item.id === id);
    if (!category) return "";

    if (!category.parentId) return category.name;

    const parentPath = getPath(category.parentId);
    return parentPath ? `${parentPath} → ${category.name}` : category.name;
  };

  const resetForm = () => {
    setCategoryName("");
    setParentId("");
    setEditingId(null);
    setError("");
  };

  const saveCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = categoryName.trim();

    if (!name) {
      setError("Please enter a category name.");
      return;
    }

    if (editingId && (parentId === editingId || getDescendantIds(editingId).includes(parentId))) {
      setError("A category cannot be placed inside itself or its own subcategory.");
      return;
    }

    const selectedParent = parentId || null;

    const duplicate = categories.some(
      (item) =>
        item.name.toLowerCase() === name.toLowerCase() &&
        item.parentId === selectedParent &&
        item.id !== editingId,
    );

    if (duplicate) {
      setError("This category already exists under the selected parent.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (editingId) {
        const category = categories.find((item) => item.id === editingId);
        if (!category) throw new Error("This category no longer exists.");
        await updateCategory({
          id: editingId,
          name,
          parentId: selectedParent,
          active: category.active,
        });
      } else {
        await createCategory({
          name,
          parentId: selectedParent,
          active: true,
        });
        if (selectedParent && !expanded.includes(selectedParent)) {
          setExpanded((current) => [...current, selectedParent]);
        }
      }
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save category.");
    } finally {
      setSaving(false);
    }
  };

  const editCategory = (category: Category) => {
    setEditingId(category.id);
    setCategoryName(category.name);
    setParentId(category.parentId || "");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteCategory = async (category: Category) => {
    const idsToDelete = new Set([
      category.id,
      ...getDescendantIds(category.id),
    ]);

    const childCount = idsToDelete.size - 1;

    const message =
      childCount > 0
        ? `Delete "${category.name}" and all ${childCount} nested subcategories?`
        : `Delete "${category.name}"?`;

    if (!window.confirm(message)) return;

    setError("");
    try {
      await deleteCategories([...idsToDelete]);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete category.");
      return;
    }

    setExpanded((current) =>
      current.filter((id) => !idsToDelete.has(id)),
    );

    if (editingId && idsToDelete.has(editingId)) resetForm();
  };

  const toggleActive = async (id: string) => {
    const category = categories.find((item) => item.id === id);
    if (!category) return;
    setError("");
    try {
      await updateCategory({
        id,
        name: category.name,
        parentId: category.parentId,
        active: !category.active,
      });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update category.");
    }
  };

  const toggleExpanded = (id: string) => {
    setExpanded((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const visibleCategories = useMemo(() => {
    if (!search.trim()) return null;

    const matchingIds = new Set<string>();
    const query = search.toLowerCase();

    categories.forEach((category) => {
      if (category.name.toLowerCase().includes(query)) {
        matchingIds.add(category.id);

        let parent = category.parentId;
        while (parent) {
          matchingIds.add(parent);
          const parentCategory = categories.find((item) => item.id === parent);
          parent = parentCategory?.parentId || null;
        }
      }
    });

    return matchingIds;
  }, [categories, search]);

  const mainCategories = categories.filter((item) => !item.parentId);
  const totalSubcategories = categories.length - mainCategories.length;
  const activeCount = categories.filter((item) => item.active).length;

  const availableParents = categories.filter((item) => {
    if (!editingId) return true;

    const blockedIds = new Set([
      editingId,
      ...getDescendantIds(editingId),
    ]);

    return !blockedIds.has(item.id);
  });

  const renderTree = (parent: Category | null, depth = 0): React.ReactNode => {
    const items = categories.filter(
      (item) => item.parentId === (parent ? parent.id : null),
    );

    return items.map((category) => {
      if (visibleCategories && !visibleCategories.has(category.id)) {
        return null;
      }

      const children = childrenOf(category.id);
      const isExpanded =
        expanded.includes(category.id) || Boolean(search.trim());

      return (
        <div className="category-tree-group" key={category.id}>
          <div
            className={`category-tree-row ${
              depth === 0 ? "main-category-row" : "nested-category-row"
            }`}
            style={{ "--category-depth": depth } as React.CSSProperties}
          >
            <button
              type="button"
              className="category-expand-button"
              onClick={() => toggleExpanded(category.id)}
              aria-label={isExpanded ? "Collapse category" : "Expand category"}
              disabled={children.length === 0}
            >
              {children.length === 0 ? (
                <span className="category-expand-placeholder" />
              ) : isExpanded ? (
                <ChevronDown size={17} />
              ) : (
                <ChevronRight size={17} />
              )}
            </button>

            {isExpanded && children.length > 0 ? (
              <FolderOpen size={19} className="category-folder-icon" />
            ) : (
              <Folder size={19} className="category-folder-icon" />
            )}

            <div className="category-tree-name">
              <strong>{category.name}</strong>
              <small>
                {getPath(category.id)}
                {children.length > 0
                  ? ` · ${children.length} direct subcategories`
                  : ""}
              </small>
            </div>

            <span
              className={`category-active-badge ${
                category.active ? "is-active" : "is-inactive"
              }`}
            >
              {category.active ? "Active" : "Inactive"}
            </span>

            <div className="category-row-actions">
              <button
                type="button"
                title="Add subcategory"
                onClick={() => {
                  setParentId(category.id);
                  setCategoryName("");
                  setEditingId(null);
                  setError("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <Plus size={16} />
              </button>

              <button
                type="button"
                title="Edit category"
                onClick={() => editCategory(category)}
              >
                <Pencil size={15} />
              </button>

              <button
                type="button"
                title="Activate or deactivate"
                onClick={() => void toggleActive(category.id)}
              >
                <Power size={15} />
              </button>

              <button
                type="button"
                title="Delete category and descendants"
                onClick={() => void deleteCategory(category)}
                className="category-delete-action"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          {isExpanded && children.length > 0 && (
            <div className="category-tree-children">
              {renderTree(category, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="category-management-page">
      <div className="category-page-header">
        <div>
          <Link to="/admin" className="category-back-link">
            <ArrowLeft size={15} /> Back to Dashboard
          </Link>
          <span>THE URBAN STYLE / ADMIN</span>
          <h1>Category Management</h1>
          <p>Create and organise unlimited levels of store categories.</p>
        </div>

        <div className="category-header-icon">
          <FolderTree size={28} />
        </div>
      </div>

      <div className="category-summary-grid">
        <div className="category-summary-card">
          <span>Main Categories</span>
          <strong>{mainCategories.length}</strong>
        </div>
        <div className="category-summary-card">
          <span>Nested Categories</span>
          <strong>{totalSubcategories}</strong>
        </div>
        <div className="category-summary-card">
          <span>Active Categories</span>
          <strong>{activeCount}</strong>
        </div>
      </div>

      <section className="category-form-card">
        {catalogueError && <p className="category-form-error" role="alert">{catalogueError}</p>}
        {loading && <p className="category-form-hint">Loading categories from Supabase…</p>}
        <div className="category-section-title">
          <div>
            <span>{editingId ? "EDIT CATEGORY" : "CREATE CATEGORY"}</span>
            <h2>{editingId ? "Update Category" : "Add New Category"}</h2>
          </div>

          {editingId && (
            <button
              type="button"
              className="category-cancel-button"
              onClick={resetForm}
            >
              <X size={15} /> Cancel
            </button>
          )}
        </div>

        <form onSubmit={(event) => void saveCategory(event)} className="category-form">
          <label>
            Category Name *
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="e.g. Pants, Cargo Pants, Slim Fit"
              maxLength={60}
            />
          </label>

          <label>
            Parent Category
            <select
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              <option value="">None — Main Category</option>
              {availableParents.map((item) => (
                <option value={item.id} key={item.id}>
                  {getPath(item.id)}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="category-form-error">{error}</p>}

          <button type="submit" className="category-submit-button" disabled={saving || loading}>
            {editingId ? <Check size={16} /> : <Plus size={16} />}
            {editingId ? "Save Changes" : "Add Category"}
          </button>
        </form>

        <p className="category-form-hint">
          Select any existing category as the parent to create a nested
          subcategory. Leave it as None to create a main category.
        </p>
      </section>

      <section className="category-list-card">
        <div className="category-section-title">
          <div>
            <span>YOUR STORE STRUCTURE</span>
            <h2>All Categories</h2>
          </div>
          <span className="category-count">{categories.length} total</span>
        </div>

        <div className="category-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search categories at any level..."
          />
        </div>

        {categories.length === 0 ? (
          <div className="category-empty">
            <FolderTree size={30} />
            <strong>No categories yet</strong>
            <p>Create your first main category above.</p>
          </div>
        ) : mainCategories.length === 0 ? (
          <div className="category-empty">
            <FolderTree size={30} />
            <strong>No main categories found</strong>
            <p>Create a main category to start your store structure.</p>
          </div>
        ) : visibleCategories && visibleCategories.size === 0 ? (
          <div className="category-empty">
            <Search size={30} />
            <strong>No matching categories</strong>
            <p>Try another search term.</p>
          </div>
        ) : (
          <div className="category-tree">{renderTree(null)}</div>
        )}
      </section>

      <div className="category-info-note">
        <FolderTree size={18} />
        <p>
          You can create as many nested category levels as your store needs.
          Deleting a parent category also deletes all its nested descendants.
          Data is currently saved in this browser only.
        </p>
      </div>
    </div>
  );
}

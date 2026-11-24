"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
} from "lucide-react";
export default function RichEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "a-prose-editor",
        "aria-label": "Rich text content",
      },
    },
  });
  if (!editor) return <div className="a-skeleton" />;
  return (
    <div className="a-rich-editor">
      <div className="a-editor-toolbar">
        {[
          {
            label: "Bold",
            icon: Bold,
            action: () => editor.chain().focus().toggleBold().run(),
          },
          {
            label: "Italic",
            icon: Italic,
            action: () => editor.chain().focus().toggleItalic().run(),
          },
          {
            label: "Heading",
            icon: Heading2,
            action: () =>
              editor.chain().focus().toggleHeading({ level: 2 }).run(),
          },
          {
            label: "Bullet list",
            icon: List,
            action: () => editor.chain().focus().toggleBulletList().run(),
          },
          {
            label: "Numbered list",
            icon: ListOrdered,
            action: () => editor.chain().focus().toggleOrderedList().run(),
          },
          {
            label: "Quote",
            icon: Quote,
            action: () => editor.chain().focus().toggleBlockquote().run(),
          },
          {
            label: "Undo",
            icon: Undo,
            action: () => editor.chain().focus().undo().run(),
          },
          {
            label: "Redo",
            icon: Redo,
            action: () => editor.chain().focus().redo().run(),
          },
          {
            label: "Link",
            icon: LinkIcon,
            action: () => {
              const url = window.prompt("Enter an https:// link");
              if (url && /^https:\/\//.test(url))
                editor.chain().focus().setLink({ href: url }).run();
            },
          },
        ].map((x) => (
          <button
            type="button"
            key={x.label}
            aria-label={x.label}
            onClick={x.action}
          >
            <x.icon size={16} />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
      <div className="a-editor-count">
        {editor.getText().trim().split(/\s+/).filter(Boolean).length} words ·{" "}
        {editor.getText().length} characters
      </div>
    </div>
  );
}

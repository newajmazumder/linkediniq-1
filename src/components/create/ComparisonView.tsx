import PostCard, { Post } from "./PostCard";

type Props = {
  posts: Post[];
  ideaId: string;
  userId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPostUpdate: (updated: Post) => void;
};

const ComparisonView = ({ posts, ideaId, userId, selectedId, onSelect, onPostUpdate }: Props) => {
  const sorted = [...posts].sort((a, b) => a.variation_number - b.variation_number);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sorted.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          ideaId={ideaId}
          userId={userId}
          selected={selectedId === post.id}
          onSelect={() => onSelect(post.id)}
          onPostUpdate={onPostUpdate}
          compact
        />
      ))}
    </div>
  );
};

export default ComparisonView;

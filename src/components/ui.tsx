import Link from "next/link";
import type { Item, SessionUser, ItemStatus } from "@/lib/types";
import { logout } from "@/app/actions";
import SubmitButton from "./SubmitButton";
export function Header({ user }: { user: SessionUser }) {
  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/items" className="brand">
          <span className="brand-mark">↗</span> Campus Lost &amp; Found
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/items">Items</Link>
          <Link href="/submit">Submit an item</Link>
          {user.role === "admin" && (
            <>
              <Link href="/manage">Security desk</Link>
              <Link href="/accounts">Accounts</Link>
            </>
          )}
        </nav>
        <div className="user-menu">
          <span>
            {user.full_name}
            <small>
              {user.role === "admin" ? "Security / Admin" : user.college_id}
            </small>
          </span>
          <form action={logout}>
            <SubmitButton className="button button-quiet">Log out</SubmitButton>
          </form>
        </div>
      </div>
    </header>
  );
}
export function Badge({ status }: { status: ItemStatus }) {
  return (
    <span className={`badge ${status}`}>
      {status === "awaiting_deposit"
        ? "Awaiting deposit"
        : status === "available"
          ? "Available"
          : "Collected"}
    </span>
  );
}
export function Notice({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  return (
    <>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="notice success">
          {success}
        </div>
      )}
    </>
  );
}
export function ItemCard({ item }: { item: Item }) {
  return (
    <Link href={`/items/${item.item_id}`} className="item-card">
      <div className="card-photo">
        <img src={`/media/${item.photo_path}`} alt={item.item_name} />
        <Badge status={item.status} />
      </div>
      <div className="card-body">
        <span className="eyebrow">
          {item.category_name}{" "}
          <span>· #{item.item_id.toString().padStart(3, "0")}</span>
        </span>
        <h2>{item.item_name}</h2>
        <p className="card-description">{item.description}</p>
        <div className="card-location">
          <span aria-hidden="true">⌖</span> {item.found_location}
        </div>
        <div className="card-bottom">
          <span>{formatDate(item.found_date)}</span>
          <span>View item ↗</span>
        </div>
      </div>
    </Link>
  );
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value.slice(0, 10) + "T12:00:00"));
}
export type SearchParams = Promise<{ error?: string; success?: string }>;

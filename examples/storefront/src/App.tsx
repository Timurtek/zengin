import { Avatar, Badge, Button, Card, Dialog, Icon, Select, Separator, Sheet, Table, TextField, Toast, Tooltip, toast } from "@zengin/ui";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, FREE_SHIPPING_FROM, money, PRODUCTS, SHIPPING, sortProducts, SORTS, type Category, type Product, type Sort } from "./data";

type Theme = "light" | "dark";
type Line = { product: Product; qty: number };

/** The theme lives on <html> so the tokens flow into the sheet, the dialog and the toasts. */
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const stamped = document.documentElement.dataset.theme;
    if (stamped === "light" || stamped === "dark") return stamped;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "light" ? "dark" : "light"))];
}

export function App() {
  const [theme, toggleTheme] = useTheme();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [sort, setSort] = useState<Sort>("featured");
  const [cart, setCart] = useState<Line[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortProducts(
      PRODUCTS.filter((p) => (category === "all" || p.category === category) && (!q || `${p.name} ${p.tagline} ${p.description}`.toLowerCase().includes(q))),
      sort,
    );
  }, [query, category, sort]);

  const count = cart.reduce((n, l) => n + l.qty, 0);
  const subtotal = cart.reduce((n, l) => n + l.qty * l.product.price, 0);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING;

  const add = (p: Product, qty = 1) => {
    setCart((lines) => {
      const at = lines.find((l) => l.product.id === p.id);
      const have = at?.qty ?? 0;
      if (have + qty > p.stock) {
        toast({ title: `Only ${p.stock} in stock`, tone: "warning" });
        return lines;
      }
      return at ? lines.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + qty } : l)) : [...lines, { product: p, qty }];
    });
    toast({ title: `${p.name} added`, description: money(p.price), tone: "success" });
  };
  const setQty = (id: string, qty: number) => setCart((lines) => (qty <= 0 ? lines.filter((l) => l.product.id !== id) : lines.map((l) => (l.product.id === id ? { ...l, qty: Math.min(qty, l.product.stock) } : l))));

  const place = () => {
    setCheckout(false);
    setCartOpen(false);
    setCart([]);
    toast({ title: "Order placed", description: `${count} item${count === 1 ? "" : "s"}, ${money(subtotal + shipping)}. A receipt is on its way.`, tone: "success" });
  };

  return (
    <Tooltip.Provider>
      <Toast.Provider position="top-right">
        <div className="shop">
          <header className="shop__bar">
            <a className="shop__brand" href="#top" aria-label="Fieldware, home">
              <Avatar name="Fieldware" shape="square" size="sm" />
              <strong>Fieldware</strong>
            </a>
            <TextField className="shop__search" size="sm" placeholder="Search the shop" aria-label="Search" value={query} onChange={(e) => setQuery(e.target.value)} leadingIcon={<Icon.Search />} />
            <div className="shop__actions">
              <Tooltip content={theme === "light" ? "Switch to dark" : "Switch to light"}>
                <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme" leadingIcon={theme === "light" ? <Icon.Moon /> : <Icon.Sun />} />
              </Tooltip>
              <Button variant="soft" size="sm" onClick={() => setCartOpen(true)} leadingIcon={<Icon.Inbox />} aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
                Cart
                {count > 0 && (
                  <Badge tone="primary" size="sm">
                    {count}
                  </Badge>
                )}
              </Button>
            </div>
          </header>

          <main className="shop__main">
            <section className="hero">
              <p className="hero__eyebrow">Hardware for people who build</p>
              <h1>Things that stay on the desk.</h1>
              <p className="hero__lead">Twelve objects we use every day, chosen slowly, sold at one price. Free shipping from {money(FREE_SHIPPING_FROM)}.</p>
            </section>

            <div className="toolbar">
              <Select className="toolbar__filter" size="sm" aria-label="Category" value={category} onValueChange={(v) => setCategory(v as Category | "all")}>
                <Select.Item value="all">All categories</Select.Item>
                {CATEGORIES.map((c) => (
                  <Select.Item key={c} value={c}>
                    {c}
                  </Select.Item>
                ))}
              </Select>
              <Select className="toolbar__filter" size="sm" aria-label="Sort" value={sort} onValueChange={(v) => setSort(v as Sort)}>
                {SORTS.map((s) => (
                  <Select.Item key={s.value} value={s.value}>
                    {s.label}
                  </Select.Item>
                ))}
              </Select>
              <p className="toolbar__count">
                {visible.length} of {PRODUCTS.length}
              </p>
            </div>

            <div className="grid z-stagger">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} onOpen={() => setDetail(p)} onAdd={() => add(p)} />
              ))}
              {visible.length === 0 && <p className="grid__empty">Nothing matches. Clear the search or pick another category.</p>}
            </div>
          </main>

          <footer className="shop__foot">
            <span>Fieldware is a template. The stock, ratings and sale flags come from mock.json.</span>
          </footer>

          <Sheet open={cartOpen} onOpenChange={setCartOpen} side="right" size="md">
            <Sheet.Content>
              <Sheet.Title>Cart</Sheet.Title>
              <Sheet.Description>{count === 0 ? "Nothing yet." : `${count} item${count === 1 ? "" : "s"}.`}</Sheet.Description>
              <div className="cart">
                {cart.map((l) => (
                  <div className="cart__line" key={l.product.id}>
                    <Art product={l.product} small />
                    <div className="cart__text">
                      <strong>{l.product.name}</strong>
                      <span>{money(l.product.price)} each</span>
                    </div>
                    <div className="cart__qty" role="group" aria-label={`Quantity of ${l.product.name}`}>
                      <Button variant="ghost" size="sm" aria-label="One fewer" leadingIcon={<Icon.Minus />} onClick={() => setQty(l.product.id, l.qty - 1)} />
                      <span>{l.qty}</span>
                      <Button variant="ghost" size="sm" aria-label="One more" leadingIcon={<Icon.Plus />} onClick={() => setQty(l.product.id, l.qty + 1)} />
                    </div>
                    <strong className="cart__total">{money(l.qty * l.product.price)}</strong>
                  </div>
                ))}
                {cart.length > 0 && (
                  <>
                    <Separator />
                    <dl className="totals">
                      <dt>Subtotal</dt>
                      <dd>{money(subtotal)}</dd>
                      <dt>Shipping</dt>
                      <dd>{shipping === 0 ? "Free" : money(shipping)}</dd>
                      <dt>Total</dt>
                      <dd>{money(subtotal + shipping)}</dd>
                    </dl>
                    {subtotal < FREE_SHIPPING_FROM && <p className="cart__note">{money(FREE_SHIPPING_FROM - subtotal)} more for free shipping.</p>}
                  </>
                )}
              </div>
              <Sheet.Footer>
                <Sheet.Close asChild>
                  <Button variant="ghost">Keep shopping</Button>
                </Sheet.Close>
                <Button tone="primary" disabled={cart.length === 0} onClick={() => setCheckout(true)} trailingIcon={<Icon.ArrowRight />}>
                  Check out
                </Button>
              </Sheet.Footer>
            </Sheet.Content>
          </Sheet>

          <Dialog open={checkout} onOpenChange={setCheckout} size="md">
            <Dialog.Content>
              <Dialog.Title>Confirm your order</Dialog.Title>
              <Dialog.Description>Ships in two days to the address on your account.</Dialog.Description>
              <div className="summary">
                <Table density="sm" aria-label="Order summary">
                  <Table.Head>
                    <Table.Row>
                      <Table.HeadCell>Item</Table.HeadCell>
                      <Table.HeadCell align="end">Qty</Table.HeadCell>
                      <Table.HeadCell align="end">Amount</Table.HeadCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {cart.map((l) => (
                      <Table.Row key={l.product.id}>
                        <Table.Cell>{l.product.name}</Table.Cell>
                        <Table.Cell align="end">{l.qty}</Table.Cell>
                        <Table.Cell align="end">{money(l.qty * l.product.price)}</Table.Cell>
                      </Table.Row>
                    ))}
                    <Table.Row>
                      <Table.Cell>Shipping</Table.Cell>
                      <Table.Cell align="end" />
                      <Table.Cell align="end">{shipping === 0 ? "Free" : money(shipping)}</Table.Cell>
                    </Table.Row>
                  </Table.Body>
                </Table>
              </div>
              <Dialog.Footer>
                <Dialog.Close asChild>
                  <Button variant="ghost">Back</Button>
                </Dialog.Close>
                <Button tone="primary" onClick={place} leadingIcon={<Icon.Check />}>
                  Place order, {money(subtotal + shipping)}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog>

          <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)} size="md">
            <Dialog.Content>
              {detail && (
                <>
                  <Dialog.Title>{detail.name}</Dialog.Title>
                  <Dialog.Description>{detail.tagline}</Dialog.Description>
                  <div className="detail">
                    <Art product={detail} />
                    <div className="detail__text">
                      <p>{detail.description}</p>
                      <p className="detail__price">
                        {money(detail.price)}
                        {detail.was && <s>{money(detail.was)}</s>}
                      </p>
                      <Stars product={detail} />
                      <Stock product={detail} />
                    </div>
                  </div>
                  <Dialog.Footer>
                    <Dialog.Close asChild>
                      <Button variant="ghost">Close</Button>
                    </Dialog.Close>
                    <Button tone="primary" disabled={detail.stock === 0} onClick={() => { add(detail); setDetail(null); }} leadingIcon={<Icon.Plus />}>
                      Add to cart
                    </Button>
                  </Dialog.Footer>
                </>
              )}
            </Dialog.Content>
          </Dialog>
        </div>
      </Toast.Provider>
    </Tooltip.Provider>
  );
}

function ProductCard({ product, onOpen, onAdd }: { product: Product; onOpen: () => void; onAdd: () => void }) {
  return (
    <Card padding="none" interactive={product.stock > 0}>
      <div className="product">
        <a
          className="product__open"
          href={`#${product.id}`}
          aria-label={`${product.name}, details`}
          onClick={(e) => {
            e.preventDefault();
            onOpen();
          }}
        >
          <Art product={product} />
        </a>
        <div className="product__body">
          <div className="product__head">
            <h2>{product.name}</h2>
            {product.sale && (
              <Badge tone="danger" size="sm">
                Sale
              </Badge>
            )}
            {!product.sale && product.stock > 0 && product.stock <= 5 && (
              <Badge tone="warning" size="sm">
                {product.stock} left
              </Badge>
            )}
            {product.stock === 0 && (
              <Badge tone="neutral" size="sm">
                Sold out
              </Badge>
            )}
          </div>
          <p>{product.tagline}</p>
          <Stars product={product} />
          <div className="product__foot">
            <span className="product__price">
              {money(product.price)}
              {product.was && <s>{money(product.was)}</s>}
            </span>
            <Button size="sm" tone="primary" variant={product.stock === 0 ? "soft" : "solid"} disabled={product.stock === 0} onClick={onAdd} leadingIcon={<Icon.Plus />}>
              Add
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** A product's picture: a category-toned panel with the initials. Swap for an <img> when there are photos. */
function Art({ product, small }: { product: Product; small?: boolean }) {
  const initials = product.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <div className="art" data-category={product.category} data-small={small ? "" : undefined} aria-hidden="true">
      <span>{initials}</span>
    </div>
  );
}

function Stars({ product }: { product: Product }) {
  const full = Math.round(product.rating);
  return (
    <p className="stars" aria-label={`${product.rating} out of 5, ${product.reviews} reviews`}>
      <span className="stars__row" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <Icon.Star key={i} data-on={i <= full ? "" : undefined} />
        ))}
      </span>
      <span>
        {product.rating} · {product.reviews}
      </span>
    </p>
  );
}

function Stock({ product }: { product: Product }) {
  if (product.stock === 0) return <Badge tone="neutral">Sold out</Badge>;
  if (product.stock <= 5) return <Badge tone="warning">{product.stock} left</Badge>;
  return <Badge tone="success">In stock</Badge>;
}

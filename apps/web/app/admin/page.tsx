"use client";

import Link from "next/link";
import {
  AlertCircle,
  BarChart3,
  BellRing,
  Clock3,
  FileSpreadsheet,
  Megaphone,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Settings,
  Store,
  Trash2,
  Truck,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminOrders, categories, menuItems, restaurant } from "@/lib/data";

const statusActions = ["Accept Order", "Start Preparing", "Mark as Ready", "Out for Delivery", "Delivered", "Cancel"];
const statusFilters = ["New", "Preparing", "Ready", "Delivered", "Cancelled"];

const reports = [
  { label: "Orders today", value: "128", icon: PackageCheck },
  { label: "Revenue today", value: "Rs 86,400", icon: BarChart3 },
  { label: "Fulfillment", value: "96%", icon: Truck },
  { label: "Avg prep time", value: "18 min", icon: Clock3 }
];

export default function AdminDashboard() {
  return (
    <main className="min-h-screen bg-[#f6f7f2]">
      <header className="sticky top-0 z-20 border-b border-border bg-white/94 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-xl font-black">Al-Arab Admin</p>
            <p className="text-xs text-muted-foreground">Orders, kitchen, menu and restaurant settings</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <BellRing size={18} />
              Alerts
            </Button>
            <Button asChild>
              <Link href="/">Customer site</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6">
        <div className="grid gap-4 md:grid-cols-4">
          {reports.map((report) => (
            <Card key={report.label}>
              <CardContent className="pt-5">
                <report.icon className="mb-4 text-primary" size={24} />
                <p className="text-2xl font-black">{report.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{report.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <CardTitle>Orders Management</CardTitle>
                <div className="relative w-full lg:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <input className="h-11 w-full rounded-md border border-border pl-10 pr-3" placeholder="Search order ID or customer" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {statusFilters.map((filter) => (
                  <Button key={filter} variant={filter === "New" ? "default" : "outline"} size="sm">
                    {filter}
                  </Button>
                ))}
              </div>
              <div className="space-y-4">
                {adminOrders.map((order) => (
                  <div key={order.id} className="rounded-lg border border-border bg-white p-4">
                    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-black">{order.id}</p>
                          <span className="rounded-md bg-accent/20 px-2 py-1 text-xs font-black">{order.status}</span>
                          <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold">Prep {order.prep}</span>
                        </div>
                        <p className="mt-2 font-semibold">{order.customer} | {order.phone}</p>
                        <p className="text-sm text-muted-foreground">{order.address}</p>
                        <p className="mt-2 text-sm">{order.items}</p>
                        <p className="mt-1 text-sm text-muted-foreground">Instructions: {order.instructions}</p>
                      </div>
                      <p className="text-xl font-black">Rs {order.total}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {statusActions.map((action) => (
                        <Button key={action} variant={action === "Cancel" ? "outline" : "secondary"} size="sm">
                          {action}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#17211d] text-white">
            <CardHeader>
              <CardTitle>Kitchen Display</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {adminOrders.map((order) => (
                <div key={order.id} className="rounded-md border border-white/14 bg-white/8 p-4">
                  <p className="text-2xl font-black">{order.id}</p>
                  <p className="mt-2 text-white/80">{order.items}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-primary">{order.status}</span>
                    <span className="font-black">{order.prep}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Menu Management</CardTitle>
                <Button>
                  <Plus size={18} />
                  Add item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <Button variant="outline">
                  <FileSpreadsheet size={18} />
                  Bulk upload CSV/Excel
                </Button>
                <Button variant="outline">
                  <Store size={18} />
                  Category management
                </Button>
              </div>
              <div className="space-y-3">
                {menuItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                    <div>
                      <p className="font-bold">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.category} | Rs {item.price} | {item.available ? "Available" : "Out of stock"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="outline" aria-label={`Edit ${item.name}`}>
                        <Pencil size={16} />
                      </Button>
                      <Button size="icon" variant="outline" aria-label={`Delete ${item.name}`}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Restaurant Settings</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {[
                ["Restaurant name", restaurant.name],
                ["Phone", restaurant.phone],
                ["Address", restaurant.address],
                ["Operating hours", "11:00 AM - 11:30 PM"],
                ["Delivery fee", `Rs ${restaurant.deliveryFee}`],
                ["Minimum order", `Rs ${restaurant.minimumOrder}`],
                ["Delivery radius", "8 km"],
                ["GST", "5%"]
              ].map(([label, value]) => (
                <label key={label} className="grid gap-1 text-sm font-semibold">
                  {label}
                  <input className="h-11 rounded-md border border-border px-3 font-normal" defaultValue={value} />
                </label>
              ))}
              <Button>
                <Settings size={18} />
                Save settings
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Reports & Analytics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {["Best-selling item: Chicken Mandi", "Peak hour: 8 PM - 9 PM", "Customer repeat rate: 42%", "Average preparation: 18 minutes"].map((item) => (
                <p key={item} className="rounded-md bg-muted p-3 text-sm font-semibold">{item}</p>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Customer Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {["View customers with contact details", "Customer order history", "Block or unblock customers"].map((item) => (
                <p key={item} className="rounded-md bg-muted p-3 text-sm font-semibold">
                  <Users className="mr-2 inline text-primary" size={16} />
                  {item}
                </p>
              ))}
              <Button variant="secondary" className="w-full">
                <Megaphone size={18} />
                Send promotion
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {["New order sound enabled", "Visual alerts enabled", "Order update log retained"].map((item) => (
                <p key={item} className="rounded-md bg-muted p-3 text-sm font-semibold">
                  <AlertCircle className="mr-2 inline text-secondary" size={16} />
                  {item}
                </p>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="rounded-lg border border-border bg-white p-5">
          <h2 className="text-xl font-black">Category Setup</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((category) => (
              <span key={category} className="rounded-md bg-muted px-3 py-2 text-sm font-bold">{category}</span>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

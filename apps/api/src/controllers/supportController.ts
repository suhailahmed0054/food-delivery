import mongoose from "mongoose";
import { Request, Response } from "express";
import { z } from "zod";
import { Order } from "../models/Order";
import { Issue } from "../models/Issue";
import { SupportMessage } from "../models/SupportMessage";
import {
  createLocalIssue,
  getLocalIssue,
  listLocalIssues,
  updateLocalIssue,
  type LocalIssue
} from "../services/localIssueStore";
import { getLocalOrder } from "../services/localOrderStore";
import {
  findOrderForTracking,
  orderTrackingRoom,
  toPublicOrderTracking
} from "../services/orderTrackingService";
import { canAccessSupportIssue } from "../services/supportAccessService";
import {
  createLocalMessage,
  listMessagesByIssue,
  type LocalSupportMessageInput
} from "../services/localSupportMessageStore";
import { createInAppNotification } from "../services/inAppNotificationService";
import {
  initiateRazorpayRefund,
  RefundProcessingError,
  type RefundResult
} from "../services/refundService";

const supportImagesSchema = z.array(z.string().max(1_500_000)).max(4).optional();
const trackingTokenSchema = z.string().trim().min(32).max(128);
const createIssueSchema = z.object({
  orderNumber: z.string().trim().min(1).max(100),
  category: z.enum(["missing_items", "wrong_items", "poor_quality", "delivery_delay", "other"]),
  description: z.string().trim().min(1).max(4000),
  desiredResolution: z.enum(["refund", "redelivery", "feedback"]),
  trackingToken: trackingTokenSchema.optional(),
  images: supportImagesSchema
});
const supportMessageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  senderName: z.string().trim().min(1).max(100).optional(),
  images: supportImagesSchema
});
const updateIssueSchema = z.object({
  status: z.enum(["open", "investigating", "resolved", "closed"]).optional(),
  resolutionDetails: z.string().trim().max(4000).optional(),
  refundAmount: z.coerce.number().finite().min(0).optional()
}).refine((value) => Object.keys(value).length > 0, "At least one update is required");
const decisionSchema = z.object({
  resolutionType: z.enum(["refund", "partial_refund", "replacement", "coupon", "rejected", "resolved"]),
  decisionReason: z.string().trim().max(2000).default(""),
  refundAmount: z.coerce.number().finite().positive().optional(),
  resolutionDetails: z.string().trim().max(4000).optional()
});

type SupportIssueRecord = LocalIssue & {
  _id?: mongoose.Types.ObjectId;
};

type SupportDecisionUpdates = Partial<
  Pick<
    LocalIssue,
    | "status"
    | "chatStatus"
    | "resolutionType"
    | "decisionReason"
    | "resolutionDetails"
    | "refundApproved"
    | "refundAmount"
    | "refundStatus"
    | "razorpayRefundId"
  >
> & { closedAt?: Date };

function isMongoConnected() {
  return Order.db.readyState === 1;
}

function routeId(req: Request) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function supportTrackingToken(req: Request) {
  const parsed = trackingTokenSchema.safeParse(
    req.header("x-order-tracking-token")
  );
  return parsed.success ? parsed.data : undefined;
}

function issueCustomerId(issue: unknown) {
  const customer = (issue as { customer?: unknown })?.customer;
  if (!customer) return undefined;
  if (typeof customer === "object" && "_id" in customer) {
    return String((customer as { _id: unknown })._id);
  }
  return String(customer);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateBase64Image(dataUrl: string): { valid: boolean; message?: string } {
  if (typeof dataUrl !== "string") {
    return { valid: false, message: "Image must be a string" };
  }

  const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!matches) {
    return { valid: false, message: "Invalid image format. Must be a base64 data URL." };
  }

  const mimeType = matches[1];
  const base64Data = matches[2];

  const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowedMimeTypes.includes(mimeType)) {
    return { valid: false, message: `Unsupported image type: ${mimeType}. Allowed: JPEG, PNG, WEBP.` };
  }

  const approxSizeInBytes = (base64Data.length * 3) / 4;
  if (approxSizeInBytes > 1024 * 1024) {
    return { valid: false, message: "Image is too large. Maximum size is 1MB per image." };
  }

  return { valid: true };
}

export async function createIssue(req: Request, res: Response) {
  const parsed = createIssueSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid support ticket", errors: parsed.error.flatten() });
  }
  const { orderNumber, category, description, desiredResolution, trackingToken, images } = parsed.data;

  // Validate images if provided
  if (images !== undefined && images !== null) {
    if (!Array.isArray(images)) {
      return res.status(400).json({ message: "Images must be an array of strings" });
    }
    if (images.length > 4) {
      return res.status(400).json({ message: "Maximum of 4 images allowed per support ticket" });
    }
    for (const img of images) {
      const validation = validateBase64Image(img);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }
    }
  }

  const isAdminOrStaff = req.user && (req.user.role === "admin" || req.user.role === "kitchen");
  const isAuthenticatedCustomer = req.user?.role === "customer";
  let order;

  if (!isAdminOrStaff && !isAuthenticatedCustomer) {
    if (!trackingToken) {
      return res.status(401).json({
        message: "A secure tracking token is required for guest support."
      });
    }
    order = await findOrderForTracking(orderNumber, trackingToken);
    if (!order) {
      return res.status(403).json({ message: "Invalid order tracking token" });
    }
  } else {
    order = isMongoConnected()
      ? await Order.findOne({ orderNumber })
      : await getLocalOrder(orderNumber);
    if (!order) return res.status(404).json({ message: "Order not found" });
  }

  if (isAuthenticatedCustomer) {
    const orderCustomerId = String(order.customer?._id || order.customer || "");
    if (orderCustomerId !== req.user!.id) {
      return res.status(403).json({ message: "You can only report issues for your own orders" });
    }
  }

  // Retrieve customer info from order
  const customerName = order.customerName || "Guest Customer";
  const customerPhone = order.phone || "N/A";
  const customerEmail = order.email || "";

  // Create issue
  let issue: SupportIssueRecord;
  if (isMongoConnected()) {
    issue = await Issue.create({
      order: order._id,
      orderNumber,
      customer: order.customer || req.user?.id,
      customerName,
      phone: customerPhone,
      email: customerEmail,
      category,
      description,
      desiredResolution,
      images: images || [],
      status: "open",
      resolutionDetails: "",
      refundAmount: 0
    });
  } else {
    issue = await createLocalIssue({
      order: order.id,
      orderNumber,
      customer: order.customer || req.user?.id,
      customerName,
      phone: customerPhone,
      email: customerEmail,
      category,
      description,
      desiredResolution,
      images: images || []
    });
  }

  // Create system message for the new ticket
  const issueId = issue._id || issue.id;
  const systemMsg = `Support ticket #${issueId} created. Category: ${category.replace("_", " ")}. An agent will review your case shortly.`;

  if (isMongoConnected()) {
    await SupportMessage.create({
      issue: issue._id,
      order: order._id,
      senderType: "system",
      senderName: "System",
      message: systemMsg,
      images: []
    });
    await Issue.findByIdAndUpdate(issue._id, {
      $set: { lastMessage: systemMsg, lastMessageAt: new Date() }
    });
    // Re-fetch to get the updated fields
    issue = (await Issue.findById(issue._id)) ?? issue;
  } else {
    await createLocalMessage({
      issue: issue.id,
      order: order.id,
      senderType: "system",
      senderName: "System",
      message: systemMsg,
      images: []
    });
    const now = new Date().toISOString();
    issue = await updateLocalIssue(issue.id, {
      lastMessage: systemMsg,
      lastMessageAt: now
    }) || issue;
  }

  // Emit socket event
  const io = req.app.get("io");
  if (io) {
    io.to("support:admins").emit("support_issue_created", issue);
  }
  await createInAppNotification(
    {
      audience: "admin",
      type: "support",
      title: "New support ticket",
      message: `${orderNumber}: ${category.replace(/_/g, " ")}`,
      href: "/admin?tab=Support",
      orderNumber,
      supportIssueId: String(issueId),
      dedupeKey: `admin:support-created:${String(issueId)}`
    },
    io
  );

  return res.status(201).json(issue);
}

export async function listIssues(req: Request, res: Response) {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const validStatuses = new Set(["open", "investigating", "resolved", "refunded", "closed"]);

  if (status && !validStatuses.has(status)) {
    return res.status(400).json({ message: "Invalid support status filter" });
  }

  if (isMongoConnected()) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { orderNumber: pattern },
        { customerName: pattern },
        { phone: pattern },
        { description: pattern }
      ];
    }
    const [issues, total] = await Promise.all([
      Issue.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Issue.countDocuments(filter)
    ]);
    return res.json({
      issues,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
    });
  }

  const normalizedSearch = search.toLowerCase();
  const filtered = (await listLocalIssues()).filter((issue) => {
    if (status && issue.status !== status) return false;
    if (!normalizedSearch) return true;
    return [issue.orderNumber, issue.customerName, issue.phone, issue.description]
      .some((value) => value.toLowerCase().includes(normalizedSearch));
  });
  const total = filtered.length;
  return res.json({
    issues: filtered.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
  });
}

export async function getCustomerIssues(req: Request, res: Response) {
  const customerId = req.user?.role === "customer" ? req.user.id : undefined;
  const orderNumber = typeof req.query.orderNumber === "string"
    ? req.query.orderNumber.trim()
    : "";
  const trackingToken = supportTrackingToken(req) ?? "";

  if (!customerId) {
    if (!orderNumber || !trackingToken) {
      return res.status(401).json({
        message: "Order number and tracking token are required for guest support."
      });
    }
    const verifiedOrder = await findOrderForTracking(orderNumber, trackingToken);
    if (!verifiedOrder) {
      return res.status(403).json({ message: "Invalid order tracking token" });
    }
  }

  const results = isMongoConnected()
    ? await Issue.find(customerId ? { customer: customerId } : { orderNumber })
        .sort({ createdAt: -1 })
        .limit(100)
    : (await listLocalIssues()).filter((issue) =>
        customerId ? issue.customer === customerId : issue.orderNumber === orderNumber
      ).slice(0, 100);

  return res.json(results);
}

export async function getIssue(req: Request, res: Response) {
  const issueId = routeId(req);
  const trackingToken = supportTrackingToken(req);
  const allowed = await canAccessSupportIssue(issueId, req.user, trackingToken);
  if (!allowed) return res.status(403).json({ message: "Support access denied" });

  const issue = isMongoConnected()
    ? await Issue.findById(issueId)
    : await getLocalIssue(issueId);
  if (!issue) return res.status(404).json({ message: "Issue not found" });
  return res.json(issue);
}

export async function updateIssue(req: Request, res: Response) {
  const issueId = routeId(req);
  const parsed = updateIssueSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid support update" });
  const { status, resolutionDetails, refundAmount } = parsed.data;

  let existingIssue = isMongoConnected()
    ? await Issue.findById(issueId)
    : await getLocalIssue(issueId);

  if (!existingIssue) {
    return res.status(404).json({ message: "Issue not found" });
  }

  // Validate refundAmount
  if (refundAmount !== undefined && refundAmount !== null) {
    const amountNum = Number(refundAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      return res.status(400).json({ message: "Refund amount must be a positive number" });
    }

    // Find related order to verify total
    const order = isMongoConnected()
      ? await Order.findOne({ orderNumber: existingIssue.orderNumber })
      : await getLocalOrder(existingIssue.orderNumber);

    if (order && amountNum > order.total) {
      return res.status(400).json({
        message: `Refund amount (Rs ${amountNum}) cannot exceed the order total (Rs ${order.total})`
      });
    }
  }

  const updates: Partial<Pick<LocalIssue, "status" | "resolutionDetails" | "refundAmount">> = {};
  if (status) updates.status = status;
  if (resolutionDetails !== undefined) updates.resolutionDetails = resolutionDetails;
  if (refundAmount !== undefined) updates.refundAmount = Number(refundAmount);

  let updatedIssue;
  if (isMongoConnected()) {
    updatedIssue = await Issue.findByIdAndUpdate(issueId, { $set: updates }, { new: true });
  } else {
    updatedIssue = await updateLocalIssue(issueId, updates);
  }

  if (!updatedIssue) {
    return res.status(500).json({ message: "Failed to update issue" });
  }

  const io = req.app.get("io");
  if (io) {
    io.to(`support:${issueId}`).emit("support_issue_updated", updatedIssue);
    io.to("support:admins").emit("support_issue_updated", updatedIssue);
  }

  return res.json(updatedIssue);
}

export async function getMessages(req: Request, res: Response) {
  const issueId = routeId(req);

  // Find the issue
  const issue = isMongoConnected()
    ? await Issue.findById(issueId)
    : await getLocalIssue(issueId);

  if (!issue) {
    return res.status(404).json({ message: "Issue not found" });
  }

  const trackingToken = supportTrackingToken(req);
  const allowed = await canAccessSupportIssue(issueId, req.user, trackingToken);
  if (!allowed) return res.status(403).json({ message: "Support access denied" });

  // Fetch messages
  let messages;
  if (isMongoConnected()) {
    messages = await SupportMessage.find({ issue: issueId })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    messages.reverse();
  } else {
    messages = (await listMessagesByIssue(issueId)).slice(-200);
  }

  return res.json(messages);
}

export async function sendMessage(req: Request, res: Response) {
  const issueId = routeId(req);
  const parsed = supportMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid support message" });
  const { message, senderName: bodySenderName, images } = parsed.data;

  // Validate images if provided
  if (images !== undefined && images !== null) {
    if (!Array.isArray(images)) {
      return res.status(400).json({ message: "Images must be an array" });
    }
    if (images.length > 4) {
      return res.status(400).json({ message: "Maximum of 4 images allowed per message" });
    }
    for (const img of images) {
      const validation = validateBase64Image(img);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }
    }
  }

  // Find the issue
  const issue = isMongoConnected()
    ? await Issue.findById(issueId)
    : await getLocalIssue(issueId);

  if (!issue) {
    return res.status(404).json({ message: "Issue not found" });
  }

  // Authorization and determine senderType/senderName
  let senderType: LocalSupportMessageInput["senderType"];
  let senderName: string;
  let senderId: string | undefined;

  const isAdminOrStaff = req.user && (req.user.role === "admin" || req.user.role === "kitchen");

  if (isAdminOrStaff) {
    senderType = "admin";
    senderName = req.user!.role === "admin" ? "Admin" : "Kitchen";
    senderId = req.user!.id;
  } else if (req.user && req.user.role === "customer") {
    const issueCustomerId = String(issue.customer?._id || issue.customer || "");
    if (issueCustomerId !== req.user.id) {
      return res.status(403).json({ message: "You can only send messages on your own issues" });
    }
    senderType = "customer";
    senderName = issue.customerName;
    senderId = req.user.id;
  } else {
    const trackingToken = supportTrackingToken(req);
    const allowed = await canAccessSupportIssue(issueId, req.user, trackingToken);
    if (!allowed) return res.status(403).json({ message: "Support access denied" });
    senderType = "guest";
    senderName = bodySenderName || issue.customerName || "Guest";
  }

  // Create SupportMessage
  let newMessage;
  const now = new Date();

  if (isMongoConnected()) {
    newMessage = await SupportMessage.create({
      issue: issue._id,
      order: issue.order,
      sender: senderId ? new mongoose.Types.ObjectId(senderId) : undefined,
      senderType,
      senderName,
      message,
      images: images || []
    });
    await Issue.findByIdAndUpdate(issue._id, {
      $set: {
        lastMessage: message,
        lastMessageAt: now
      }
    });
  } else {
    newMessage = await createLocalMessage({
      issue: issue.id,
      order: issue.order,
      sender: senderId,
      senderType,
      senderName,
      message,
      images: images || []
    });
    await updateLocalIssue(issue.id, {
      lastMessage: message,
      lastMessageAt: now.toISOString()
    });
  }

  // Emit socket events
  const io = req.app.get("io");
  if (io) {
    const msgId = newMessage._id || newMessage.id;
    io.to(`support:${issueId}`).emit("support:message", {
      issueId,
      message: newMessage
    });
    io.to(`support:${issueId}`).emit("support_message_sent", {
      issueId,
      message: newMessage
    });
  }

  const notificationCustomerId = issueCustomerId(issue);
  if (senderType === "admin" && notificationCustomerId) {
    const messageId = String(newMessage._id || newMessage.id);
    await createInAppNotification(
      {
        audience: "customer",
        recipient: notificationCustomerId,
        type: "support",
        title: "New support reply",
        message: String(message).trim().slice(0, 240),
        href: `/support/chat/${issueId}`,
        orderNumber: issue.orderNumber,
        supportIssueId: issueId,
        dedupeKey: `customer:${notificationCustomerId}:support-message:${messageId}`
      },
      io
    );
  } else if (senderType !== "admin") {
    const messageId = String(newMessage._id || newMessage.id);
    await createInAppNotification(
      {
        audience: "admin",
        type: "support",
        title: "Customer support reply",
        message: `${issue.orderNumber}: ${String(message).trim().slice(0, 200)}`,
        href: "/admin",
        orderNumber: issue.orderNumber,
        supportIssueId: issueId,
        dedupeKey: `admin:support-message:${messageId}`
      },
      io
    );
  }

  return res.status(201).json(newMessage);
}

export async function assignIssue(req: Request, res: Response) {
  const issueId = routeId(req);

  // Find issue
  const issue = isMongoConnected()
    ? await Issue.findById(issueId)
    : await getLocalIssue(issueId);

  if (!issue) {
    return res.status(404).json({ message: "Issue not found" });
  }

  const agentId = req.user!.id;
  const agentName = req.user!.role === "admin" ? "Admin Agent" : "Kitchen Agent";
  const now = new Date();

  // Update issue
  let updatedIssue;
  if (isMongoConnected()) {
    updatedIssue = await Issue.findByIdAndUpdate(
      issueId,
      {
        $set: {
          assignedAgent: new mongoose.Types.ObjectId(agentId),
          assignedAgentName: agentName,
          chatStatus: "active"
        }
      },
      { new: true }
    );
  } else {
    updatedIssue = await updateLocalIssue(issueId, {
      assignedAgent: agentId,
      assignedAgentName: agentName,
      chatStatus: "active"
    });
  }

  // Create system message
  const systemMsg = `Agent ${agentName} has joined the conversation.`;

  if (isMongoConnected()) {
    await SupportMessage.create({
      issue: updatedIssue!._id,
      order: updatedIssue!.order,
      senderType: "system",
      senderName: "System",
      message: systemMsg,
      images: []
    });
    await Issue.findByIdAndUpdate(issueId, {
      $set: { lastMessage: systemMsg, lastMessageAt: now }
    });
    updatedIssue = await Issue.findById(issueId);
  } else {
    await createLocalMessage({
      issue: issueId,
      order: updatedIssue!.order,
      senderType: "system",
      senderName: "System",
      message: systemMsg,
      images: []
    });
    updatedIssue = await updateLocalIssue(issueId, {
      lastMessage: systemMsg,
      lastMessageAt: now.toISOString()
    });
  }

  // Emit socket events
  const io = req.app.get("io");
  if (io) {
    io.to(`support:${issueId}`).emit("support_agent_joined", {
      issueId,
      agentName,
      issue: updatedIssue
    });
    io.to("support:admins").emit("support_agent_joined", {
      issueId,
      agentName,
      issue: updatedIssue
    });
  }

  const assignedCustomerId = issueCustomerId(updatedIssue);
  if (assignedCustomerId) {
    await createInAppNotification(
      {
        audience: "customer",
        recipient: assignedCustomerId,
        type: "support",
        title: "Support agent joined",
        message: `${agentName} is reviewing your ticket for ${issue.orderNumber}.`,
        href: `/support/chat/${issueId}`,
        orderNumber: issue.orderNumber,
        supportIssueId: issueId,
        dedupeKey: `customer:${assignedCustomerId}:support-assigned:${issueId}`
      },
      io
    );
  }

  return res.json(updatedIssue);
}

export async function decideIssue(req: Request, res: Response) {
  const issueId = routeId(req);
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid support decision" });
  const { resolutionType, decisionReason, refundAmount, resolutionDetails } = parsed.data;

  // Find issue
  const issue = isMongoConnected()
    ? await Issue.findById(issueId)
    : await getLocalIssue(issueId);

  if (!issue) {
    return res.status(404).json({ message: "Issue not found" });
  }

  const now = new Date();
  const updates: SupportDecisionUpdates = {
    resolutionType,
    decisionReason: decisionReason || "",
    resolutionDetails: resolutionDetails || issue.resolutionDetails || ""
  };
  let refundResult: RefundResult | null = null;

  // Determine status based on resolutionType
  if (resolutionType === "refund" || resolutionType === "partial_refund") {
    updates.status = "investigating";
    updates.chatStatus = "active";
  } else {
    updates.status = "resolved";
    updates.chatStatus = "closed";
    updates.closedAt = now;
  }

  // Handle refund logic
  if (resolutionType === "refund" || resolutionType === "partial_refund") {
    const amountNum = Number(refundAmount);
    if (!refundAmount || isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ message: "Refund amount must be greater than 0" });
    }

    // Find related order to verify total
    const order = isMongoConnected()
      ? await Order.findOne({ orderNumber: issue.orderNumber })
      : await getLocalOrder(issue.orderNumber);

    if (!order) {
      return res.status(404).json({ message: "Related order not found" });
    }
    if (amountNum > order.total) {
      return res.status(400).json({
        message: `Refund amount (Rs ${amountNum}) cannot exceed the order total (Rs ${order.total})`
      });
    }

    updates.refundApproved = true;
    updates.refundAmount = amountNum;
    try {
      refundResult = await initiateRazorpayRefund({
        order,
        amount: amountNum,
        idempotencyKey: `support:${issueId}:${resolutionType}:${Math.round(amountNum * 100)}`,
        reason: decisionReason || `Support ${resolutionType.replace("_", " ")}`,
        issueId: isMongoConnected() ? issueId : undefined
      });
    } catch (error) {
      if (error instanceof RefundProcessingError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Unable to initiate support refund", error);
      return res.status(502).json({ message: "Razorpay could not initiate the refund" });
    }

    updates.refundStatus = refundResult.status;
    if (refundResult.providerRefundId) {
      updates.razorpayRefundId = refundResult.providerRefundId;
    }
    if (refundResult.status === "processed") {
      updates.status = "refunded";
      updates.chatStatus = "closed";
      updates.closedAt = now;
    }

    // Emit order_updated
    const finalOrder = isMongoConnected()
      ? await Order.findOne({ orderNumber: issue.orderNumber })
      : await getLocalOrder(issue.orderNumber);

    const io = req.app.get("io");
    if (io && finalOrder) {
      const trackingUpdate = toPublicOrderTracking(finalOrder);
      const room = orderTrackingRoom(trackingUpdate.orderNumber);
      io.to(room).emit("order:status", trackingUpdate);
      io.to("orders:staff").emit("order_updated", trackingUpdate);
    }
  }

  // Update issue
  let updatedIssue;
  if (isMongoConnected()) {
    updatedIssue = await Issue.findByIdAndUpdate(
      issueId,
      {
        $set: updates,
        ...(!updates.closedAt ? { $unset: { closedAt: 1 } } : {})
      },
      { new: true }
    );
  } else {
    const localUpdates = {
      ...updates,
      closedAt: updates.closedAt ? now.toISOString() : undefined
    };
    updatedIssue = await updateLocalIssue(issueId, localUpdates);
  }

  // Create system message describing the decision
  let systemMsg = `Issue resolved with decision: ${resolutionType.replace("_", " ")}.`;
  if (decisionReason) {
    systemMsg += ` Reason: ${decisionReason}`;
  }
  if (resolutionType === "refund" || resolutionType === "partial_refund") {
    systemMsg = refundResult?.status === "processed"
      ? `Refund of Rs ${updates.refundAmount} was processed by Razorpay.`
      : `Refund of Rs ${updates.refundAmount} was initiated and is awaiting Razorpay confirmation.`;
  }

  if (isMongoConnected()) {
    await SupportMessage.create({
      issue: updatedIssue!._id,
      order: updatedIssue!.order,
      senderType: "system",
      senderName: "System",
      message: systemMsg,
      images: []
    });
    await Issue.findByIdAndUpdate(issueId, {
      $set: { lastMessage: systemMsg, lastMessageAt: now }
    });
    updatedIssue = await Issue.findById(issueId);
  } else {
    await createLocalMessage({
      issue: issueId,
      order: updatedIssue!.order,
      senderType: "system",
      senderName: "System",
      message: systemMsg,
      images: []
    });
    updatedIssue = await updateLocalIssue(issueId, {
      lastMessage: systemMsg,
      lastMessageAt: now.toISOString()
    });
  }

  // Emit socket events
  const io = req.app.get("io");
  if (io) {
    io.to(`support:${issueId}`).emit("support_issue_updated", updatedIssue);
    io.to("support:admins").emit("support_issue_updated", updatedIssue);
    if (updatedIssue?.chatStatus === "closed") {
      io.to(`support:${issueId}`).emit("support_issue_closed", {
        issueId,
        issue: updatedIssue,
        resolutionType,
        decisionReason
      });
      io.to("support:admins").emit("support_issue_closed", {
        issueId,
        issue: updatedIssue,
        resolutionType,
        decisionReason
      });
    }
  }

  const resolvedCustomerId = issueCustomerId(updatedIssue);
  if (resolvedCustomerId) {
    await createInAppNotification(
      {
        audience: "customer",
        recipient: resolvedCustomerId,
        type: "support",
        title: updatedIssue?.chatStatus === "closed"
          ? "Support ticket resolved"
          : "Refund initiated",
        message: systemMsg.slice(0, 300),
        href: `/support/chat/${issueId}`,
        orderNumber: issue.orderNumber,
        supportIssueId: issueId,
        dedupeKey: `customer:${resolvedCustomerId}:support-resolved:${issueId}:${resolutionType}`
      },
      io
    );
  }

  return res.json(updatedIssue);
}

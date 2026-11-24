import { ZodError } from "zod";
import { NextResponse } from "next/server";
import { HttpError } from "./access";
export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: "Please check the form fields and try again." },
      { status: 400 },
    );
  const code = (error as { code?: string })?.code;
  if (code === "P2002")
    return NextResponse.json(
      { error: "That slug or email is already in use." },
      { status: 409 },
    );
  if (code === "P2025")
    return NextResponse.json(
      { error: "This record could not be found." },
      { status: 404 },
    );
  console.error(
    "API operation failed",
    error instanceof Error ? error.name : "Unknown",
  );
  return NextResponse.json(
    {
      error:
        "Unable to connect to the database or complete this operation. Please retry.",
    },
    { status: 503 },
  );
}

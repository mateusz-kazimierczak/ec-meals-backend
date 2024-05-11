import { NextResponse } from "next/server";
import * as jose from "jose";

const invalidAuthRes = new NextResponse(
  JSON.stringify({ success: false, message: "invalid Authentication" }),
  { status: 401, headers: { "content-type": "application/json" } }
);

export default async function middleware(req, res) {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");

    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS,PATCH,DELETE,POST,PUT",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  // Path does not require any authentication
  if (
    !adminOnly.includes(req.nextUrl.pathname) &&
    !authOnly.includes(req.nextUrl.pathname)
  ) {
    return NextResponse.next();
  }

  let token = req.headers.get("Authorization"); // get token from header (this is currently logged in user)

  try {
    const user = await jose.jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );
    const response = NextResponse.next();
    response.headers.append("userID", user.payload.id);
    response.headers.append("userRole", user.payload.role);

    if (adminOnly.includes(req.nextUrl.pathname)) {
      if (user.payload.role == "admin") return response;
      else {
        return invalidAuthRes;
      }
    }
    return response;
  } catch (err) {
    return invalidAuthRes;
  }
}

const adminOnly = ["/api/users/all", "/api/diets"];
const authOnly = [
  "/api/users/single",
  "/api/meals",
  "/api/preferences",
  "/api/home",
];

const SITE_URL = process.env.SITE_URL || "https://www.ernescliff.ca";

import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";


export const GithubAccessTokenEmail = ({ name = "test_name", username = "test_username", pass = "test_pass" }) => (
  <Html>
    <Head />
    <Preview>
      Welcome to Ernescliff!
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src={`https://www.ernescliff.ca/wp-content/uploads/2020/02/cropped-EC_Logo_hor_rgb_new.png`}
          height="32"
          alt="Github"
        />

        <Text style={title}>
          Welcome to Ernescliff!
        </Text>

        <Section style={section}>
          <Text style={text}>
            Hey <strong>{name}</strong>!
          </Text>
          <Text style={text}>
            An account has been created for you on the Ernescliff meal app.
            You can access it using the following credentials:
          </Text>

          <Section>
            <Text style={credentialText}>
              <strong>Username:</strong> {username}
            </Text>
            <Text style={credentialText}>
              <strong>Password:</strong> {pass}
            </Text>
          </Section>

          <Button href={SITE_URL} style={button}>Go to app</Button>
        </Section>

        <Text style={footer}>
        Ernescliff College ・156 St George St, Toronto,
        </Text>
      </Container>
    </Body>
  </Html>
);

export default GithubAccessTokenEmail;

const main = {
  backgroundColor: "#ffffff",
  color: "#24292e",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
};

const container = {
  width: "480px",
  margin: "0 auto",
  padding: "20px 0 48px",
};

const title = {
  fontSize: "24px",
  lineHeight: 1.25,
};

const section = {
  padding: "24px",
  border: "solid 1px #dedede",
  borderRadius: "5px",
  textAlign: "center",
};

const text = {
  margin: "0 0 10px 0",
  textAlign: "left",
};

const credentialText = {
  margin: "0 0 10px 0",
  textAlign: "left",
  fontSize: "14px",
  backgroundColor: "#f6f8fa",
  padding: "10px",
  borderRadius: "5px",
}

const button = {
  fontSize: "14px",
  backgroundColor: "#28a745",
  color: "#fff",
  lineHeight: 1.5,
  borderRadius: "0.5em",
  padding: "0.75em 1.5em",
};

const links = {
  textAlign: "center",
};

const link = {
  color: "#0366d6",
  fontSize: "12px",
};

const footer = {
  color: "#6a737d",
  fontSize: "12px",
  textAlign: "center",
  marginTop: "60px",
};

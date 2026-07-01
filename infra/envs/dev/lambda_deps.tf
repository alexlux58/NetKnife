# ------------------------------------------------------------------------------
# LAMBDA NPM DEPENDENCIES + SHARED MODULE
# ------------------------------------------------------------------------------
# Zips include backend/functions/*/node_modules when package.json exists.
# prepare-lambda-shared.sh copies netknife-common into the layer tree and PoC
# function node_modules before Terraform archives run.

locals {
  lambda_functions_root = abspath("${path.module}/../../../backend/functions")
  lambda_shared_root    = abspath("${path.module}/../../../backend/shared/netknife-common")
  lambda_package_jsons  = fileset(local.lambda_functions_root, "*/package.json")
  lambda_shared_files   = fileset(local.lambda_shared_root, "**")
  lambda_npm_trigger = sha256(join("", concat(
    [
      for pkg in sort(local.lambda_package_jsons) :
      "${filemd5("${local.lambda_functions_root}/${pkg}")}${filemd5("${local.lambda_functions_root}/${replace(pkg, "package.json", "index.js")}")}"
    ],
    [
      for file in sort(local.lambda_shared_files) :
      filemd5("${local.lambda_shared_root}/${file}")
    ],
    [filemd5(abspath("${path.module}/../../scripts/prepare-lambda-shared.sh"))]
  )))
}

resource "null_resource" "lambda_functions_npm" {
  triggers = {
    packages = local.lambda_npm_trigger
  }

  provisioner "local-exec" {
    command     = "bash ${abspath("${path.module}/../../scripts/install-lambda-deps.sh")} && bash ${abspath("${path.module}/../../scripts/prepare-lambda-shared.sh")}"
    working_dir = abspath("${path.module}/../../..")
  }
}
